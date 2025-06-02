const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { PrismaClient } = require("./generated/prisma");
const bcrypt = require("bcryptjs"); // Import bcryptjs
const jwt = require("jsonwebtoken"); // Import jsonwebtoken

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: "http://localhost:3000", // frontend origin
		methods: ["GET", "POST"],
	},
});

// TODO : Send the statistics to the database.
// TODO : Add the logic for the game round history to be saved in the database.
// TODO : Change logic to use only the database for the rooms and not the memory ???
// TODO : Add leaderboard logic - add the leaderboard to the database and show it in the game.
// TODO : Fix room creation logic - check all options are working correctly.
// TODO : Add logged in user statistics display + retrieval from the database.
// TODO : Add a destroy room button - remove the room from the database and memory and removes all sockets from the room.
// TODO : Add a join from a list of rooms - show the list of rooms and allow the user to join a room.
// TODO : Add logic for the points for guessers and drawers.
// TODO : Add frontend beuty
// TODO : Dockerize the app

const JWT_SECRET = process.env.JWT_SECRET;
// TODO: should be handled as a call to the database
//const KEYWORDS_LIST = ["apple", "banana", "car", "house", "tree", "sun", "moon", "star", "book", "clock", "river", "mountain", "bridge", "flower", "fish"];
let games = {}; // roomID : game object
let roomsBeingDeleted = new Set(); // Rooms currently being deleted

async function generateRoomId() {
	let newRoomId;
	let roomExists = true;
	do {
		newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
		// Check if it exists in memory OR in the database
		const dbRoom = await prisma.room
			.findUnique({ where: { roomId: newRoomId } })
			.catch(() => null);
		roomExists = !!games[newRoomId] || !!dbRoom;
	} while (roomExists);
	return newRoomId;
}

async function disconnectRoomSockets(roomId) {
	const sockets = await io.in(roomId).fetchSockets();
	sockets.forEach((socket) => {
		console.log(`Disconnecting socket ${socket.id} from room ${roomId}`);
		socket.disconnect(true);
	});
}
async function getRandomKeyword() {
	try {
		const count = await prisma.keyword.count();

		if (count === 0) {
			console.error("No keywords in the database!");
			return "default";
		}

		const randomIndex = Math.floor(Math.random() * count);

		const randomKeyword = await prisma.keyword.findMany({
			skip: randomIndex,
			take: 1,
		});

		return randomKeyword[0].word;
	} catch (error) {
		console.error("Error:", error);
		return "default";
	}
}

async function getRandomKeywords(count = 3) {
	try {
		const totalCount = await prisma.keyword.count();
		if (totalCount === 0) {
			console.error("No keywords in the database!");
			return [{ word: "default", difficulty: 1 }];
		}

		// Get words of different difficulties
		const difficulties = [1, 2, 3, 4, 5];
		const selectedWords = [];

		// Try to get one word from each difficulty level, up to count
		for (let i = 0; i < Math.min(count, difficulties.length); i++) {
			const difficulty = difficulties[i];

			try {
				const wordsWithDifficulty = await prisma.keyword.findMany({
					where: { difficulty: difficulty },
				});

				if (wordsWithDifficulty.length > 0) {
					const randomIndex = Math.floor(
						Math.random() * wordsWithDifficulty.length
					);
					selectedWords.push(wordsWithDifficulty[randomIndex]);
				}
			} catch (error) {
				console.error(
					`Error getting words with difficulty ${difficulty}:`,
					error
				);
			}
		}

		// If we don't have enough words, fill with random ones
		while (selectedWords.length < count) {
			const randomIndex = Math.floor(Math.random() * totalCount);
			const randomWord = await prisma.keyword.findMany({
				skip: randomIndex,
				take: 1,
			});

			if (
				randomWord[0] &&
				!selectedWords.find((w) => w.word === randomWord[0].word)
			) {
				selectedWords.push(randomWord[0]);
			}
		}

		// Sort by difficulty for consistent display
		return selectedWords.sort((a, b) => a.difficulty - b.difficulty);
	} catch (error) {
		console.error("Error getting random keywords:", error);
		return [{ word: "default", difficulty: 1 }];
	}
}

// New function to handle word selection
function selectWordForRound(roomId, selectedWord) {
	const game = games[roomId];
	if (!game) return;

	// Clear word choice timer
	if (game.wordChoiceTimer) {
		clearTimeout(game.wordChoiceTimer);
		game.wordChoiceTimer = null;
	}

	// Set the chosen word
	game.keyword = selectedWord.word;
	game.round_history[game.currentRound].keyword = selectedWord.word;

	// Set round end time (start the actual drawing round)
	const roundDurationMs = game.roundDuration * 1000;
	game.roundEndTime = Date.now() + roundDurationMs;

	if (game.roundTimer) clearTimeout(game.roundTimer);
	game.roundTimer = setTimeout(() => endRound(roomId), roundDurationMs);

	// Emit new_round event to start actual gameplay
	io.to(roomId).emit("new_round", {
		drawingPaths: [],
		currentRound: game.currentRound,
		maxRounds: game.maxRounds,
		drawerId: game.drawerId,
		roundEndTime: game.roundEndTime,
		gameStatus: "playing",
	});

	// Send the chosen keyword to the drawer
	io.to(game.drawerId).emit("new_keyword", { keyword: game.keyword });

	console.log(
		`Round ${game.currentRound} started with word: ${game.keyword} (difficulty: ${selectedWord.difficulty})`
	);
}

function getDrawer(roomId) {
	// TODO : What if the player is no longer in the game - check for validity.
	const game = games[roomId];
	const randomIndex = Math.floor(Math.random() * game.players.length);
	if (game.currentRound === 1) {
		// First round, drawer is the owner
		const ownerPlayer = game.players.find((p) => p.dbUserId === game.ownerId);
		return ownerPlayer ? ownerPlayer.id : null;
	} else {
		if (game.drawerChoice === "queue") {
			// The player that is at the start of the queue is selected as the drawer
			game.drawerQueue = game.drawerQueue.filter((queuedPlayer) =>
				game.players.some((player) => player.id === queuedPlayer.socketId)
			);
			if (game.drawerQueue.length === 0) return game.players[randomIndex].id;
			const nextDrawer = game.drawerQueue.shift(); // Remove the first player from the queue
			// Broadcast updated queue after removing the drawer
			io.to(roomId).emit("drawer_queue_updated", {
				drawerQueue: game.drawerQueue.map((p) => ({
					username: p.username,
					socketId: p.socketId,
				})),
			});
			return nextDrawer.socketId;
		} else if (game.drawerChoice === "winner") {
			// The player that guessed first in the last round becomes the drawer
			// round_history: {}, // { roundNumber: { drawerId, keyword, correct_guesses in order [player1, player2, player3], all_guesses {} } }
			const lastRound = game.round_history[game.currentRound - 1];
			if (
				!lastRound ||
				!lastRound.correct_guesses ||
				lastRound.correct_guesses.length === 0
			)
				return game.players[randomIndex].id;
			const firstGuesserId = lastRound.correct_guesses[0];
			let winnerPlayer = game.players.find((p) => p.id === firstGuesserId);
			return winnerPlayer.id; // Always return the socket ID
		} else {
			// else random
			return game.players[randomIndex].id;
		}
	}
}

// Helper function to mark a room as inactive in the database
async function markRoomInactive(roomId) {
	try {
		// Update the room in the database
		await prisma.room.update({
			where: { roomId },
			data: {
				status: "ended",
				updatedAt: new Date(),
			},
		});
		return true;
	} catch (error) {
		console.error(`Error marking room ${roomId} as inactive:`, error);
		return false;
	}
}

// Helper function to remove a room from the database
async function deleteRoomFromDatabase(roomId) {
	// Sprawdź czy pokój jest już w trakcie usuwania
	if (roomsBeingDeleted.has(roomId)) {
		console.log(`Room ${roomId} is already being deleted, skipping.`);
		return true;
	}

	// Oznacz pokój jako "w trakcie usuwania"
	roomsBeingDeleted.add(roomId);

	try {
		// Najpierw sprawdź czy pokój istnieje
		const roomExists = await prisma.room.findUnique({
			where: { roomId },
		});

		// Jeśli pokój nie istnieje, zaloguj to i zwróć sukces
		if (!roomExists) {
			console.log(`Room ${roomId} not found in database, no need to delete.`);
			return true;
		}

		// Usuń pokój z bazy danych
		await prisma.room.delete({
			where: { roomId },
		});
		console.log(`Room ${roomId} successfully deleted from database`);
		return true;
	} catch (error) {
		console.error(`Error deleting room ${roomId} from database:`, error);
		return false;
	} finally {
		// Zawsze usuń z seta po zakończeniu
		roomsBeingDeleted.delete(roomId);
	}
}

// Registration
app.post("/api/register", async (req, res) => {
	const { username, password } = req.body;
	if (!username || !password) {
		return res
			.status(400)
			.json({ success: false, message: "Username and password are required." });
	} else if (password.length < 6) {
		return res.status(400).json({
			success: false,
			message: "Password must be at least 6 characters long.",
		});
	}
	try {
		const existingUser = await prisma.user.findUnique({ where: { username } });
		if (existingUser) {
			return res
				.status(409)
				.json({ success: false, message: "Username already taken." });
		}
		const hashedPassword = await bcrypt.hash(password, 10);
		const newUser = await prisma.user.create({
			data: { username, hashedPassword },
		});
		res.status(201).json({
			success: true,
			message: "Registration successful! Please log in.",
			user: { id: newUser.id, username: newUser.username },
		});
	} catch (error) {
		console.error("Registration error:", error);
		res.status(500).json({
			success: false,
			message: "Registration failed. Please try again.",
		});
	}
});

// Login
app.post("/api/login", async (req, res) => {
	const { username, password } = req.body;
	if (!username || !password) {
		return res
			.status(400)
			.json({ success: false, message: "Username and password are required." });
	}
	try {
		const user = await prisma.user.findUnique({ where: { username } });
		if (!user) {
			return res
				.status(401)
				.json({ success: false, message: "Invalid username or password." });
		}
		const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
		if (!isPasswordValid) {
			return res
				.status(401)
				.json({ success: false, message: "Invalid username or password." });
		}
		const tokenPayload = { userId: user.id, username: user.username };
		const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "1h" });
		res.json({ success: true, message: "Login successful!", token });
	} catch (error) {
		console.error("Login error:", error);
		res
			.status(500)
			.json({ success: false, message: "Login failed. Please try again." });
	}
});

app.post("/api/auth/google", async (req, res) => {
	const { googleId, email, name, image } = req.body;

	try {
		// Check if user exists by email
		let user = await prisma.user.findUnique({
			where: { email },
		});

		if (!user) {
			// Create new user for Google OAuth
			const username = email.split("@")[0]; // Generate username from email
			user = await prisma.user.create({
				data: {
					email,
					name,
					image,
					username,
					// hashedPassword is null for OAuth users
				},
			});
		} else {
			// Update existing user with Google data if needed
			if (!user.name || !user.image) {
				user = await prisma.user.update({
					where: { id: user.id },
					data: {
						name: name || user.name,
						image: image || user.image,
					},
				});
			}
		}

		// Generate JWT token for this user (consistent with your existing system)
		const tokenPayload = { userId: user.id, username: user.username };
		const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "1h" });

		res.json({
			success: true,
			user: {
				id: user.id,
				username: user.username,
				email: user.email,
			},
			token,
		});
	} catch (error) {
		console.error("Google auth error:", error);
		res.status(500).json({ success: false, message: "Authentication failed" });
	}
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
	const authHeader = req.headers["authorization"];
	const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

	if (token == null) return res.sendStatus(401); // if there isn't any token

	jwt.verify(token, JWT_SECRET, (err, user) => {
		if (err) {
			console.error("JWT verification error:", err.message);
			return res
				.status(403)
				.json({ success: false, message: "Token is not valid or expired." }); // if token is not valid
		}
		req.user = user; // Add decoded user payload to request
		next(); // pass the execution off to whatever request the client intended
	});
};

// Create Room
app.post("/api/rooms/create", authenticateToken, async (req, res) => {
	const { settings } = req.body;
	const creatorUsername = req.user.username; // From JWT
	// TODO : Add connection between users and rooms in DB
	const creatorDbId = req.user.userId; // From JWT

	try {
		const roomId = await generateRoomId();

		const dbRoom = await prisma.room.create({
			data: {
				roomId: roomId,
				maxPlayers: settings?.maxPlayers || 8,
				accessCode:
					settings?.isPrivate && settings?.accessCode
						? settings.accessCode
						: null,
				ownerId: creatorDbId, // to track room ownership
				gameMode: settings?.gameMode || "rounds",
				maxRounds: settings?.maxRounds || 5,
				pointsToWin: settings?.pointsToWin || 3,
				roundDuration: settings?.roundDuration || 60,
				drawerChoice: settings?.drawerChoice || "random",
			},
		});
		console.log(`Room ${dbRoom.roomId} created in DB by ${creatorUsername}.`);

		// Initialize in-memory game state. The creator will join via Socket.IO on game page.
		games[roomId] = {
			// Creation data
			roomId: roomId,
			ownerId: creatorDbId,
			ownerUsername: creatorUsername,
			// Game settings
			maxPlayers: dbRoom.maxPlayers,
			accessCode: dbRoom.accessCode,
			gameMode: dbRoom.gameMode,
			maxRounds: dbRoom.maxRounds,
			pointsToWin: dbRoom.pointsToWin,
			roundDuration: dbRoom.roundDuration,
			drawerChoice: dbRoom.drawerChoice,
			drawerQueue: [],
			// Game state
			drawerId: null,
			keyword: null,
			drawingPaths: [],
			players: [], // (socket)Id, username, dbUserId
			round_history: {
				// 1: {
				//   drawerId: null,
				//   keyword: null,
				//   correct_guesses: [],
				//   all_guesses: {} // { playerId: guess }
				// }
			},
			scores: {}, // Player scores: { playerId: score }
			currentRound: 0,
			gameStatus: "waiting",
		};
		console.log(
			`Room ${dbRoom.roomId} created in memory by ${creatorUsername}.`
		);
		res
			.status(201)
			.json({ success: true, roomId: dbRoom.roomId, isOwner: true });
	} catch (error) {
		console.error("Error creating room via API:", error);
		res.status(500).json({ success: false, message: "Failed to create room." });
	}
});

// Validate Room Code (for joining)
app.get("/api/rooms/validate/:roomId", async (req, res) => {
	const { roomId } = req.params;
	try {
		const dbRoom = await prisma.room.findUnique({ where: { roomId } });
		if (!dbRoom) {
			return res
				.status(404)
				.json({ success: false, message: "Room not found." });
		}
		// Check if room is in memory (i.e., active)
		const game = games[roomId];
		if (!game) {
			// If not in memory, but in DB, it might be an old room or needs re-initialization
			// For simplicity, let's assume if not in `games`, it's not actively joinable for now
			// Or, you could re-initialize it here if desired.
			console.warn(
				`Room ${roomId} found in DB but not in active games memory.`
			);
			// Re-initialize if needed, or treat as not joinable
			return res
				.status(404)
				.json({ success: false, message: "Room is not currently active." });
		}

		if (game && game.players.length >= game.maxPlayers) {
			return res.status(403).json({ success: false, message: "Room is full." });
		}

		res.json({
			success: true,
			roomId: dbRoom.roomId,
			isPrivate: !!dbRoom.accessCode,
		});
	} catch (error) {
		console.error("Error validating room:", error);
		res
			.status(500)
			.json({ success: false, message: "Failed to validate room." });
	}
});

// 1. Update getPublicGameState to handle undefined game
function getPublicGameState(game) {
	if (!game) {
		return null;
	}

	return {
		roomId: game.roomId,
		ownerId: game.ownerId,
		ownerUsername: game.ownerUsername, // Dodaj tę linię
		maxPlayers: game.maxPlayers,
		accessCode: game.accessCode,
		gameMode: game.gameMode,
		maxRounds: game.maxRounds,
		pointsToWin: game.pointsToWin,
		roundDuration: game.roundDuration,
		drawerChoice: game.drawerChoice,
		drawerQueue: game.drawerQueue || [],
		drawerId: game.drawerId,
		keyword: null, // never send the keyword to all clients!
		drawingPaths: game.drawingPaths,
		players: game.players.map((p) => ({
			id: p.id,
			username: p.username,
			dbUserId: p.dbUserId,
		})),
		scores: game.scores,
		currentRound: game.currentRound,
		gameStatus: game.gameStatus,
	};
}

// Socket.IO connection
io.on("connection", (socket) => {
	console.log("Socket connected:", socket.id);

	socket.on(
		"join_room",
		async ({ roomId, token, accessCode: providedAccessCode }, callback) => {
			socket.roomId = roomId;
			let joiningUsername = `Guest-${socket.id.substring(0, 4)}`;
			let joiningUserId = null;
			let isAuthenticated = false;
			let game = null; // Declare game here to keep it in scope

			if (token) {
				try {
					const decoded = jwt.verify(token, JWT_SECRET);
					joiningUsername = decoded.username;
					joiningUserId = decoded.userId;
					isAuthenticated = true;
				} catch (e) {
					console.warn(
						`Join room ${roomId} with invalid/expired token by ${socket.id}, proceeding as guest.`
					);
				}
			}

			try {
				game = games[roomId]; // Assign to the variable declared above

				if (!game) {
					return callback({
						success: false,
						message: "Game session not found or not active.",
					});
				}

				const publicGameState = getPublicGameState(game);
				const isRoomOwner = isAuthenticated && joiningUserId === game.ownerId;

				// If room is private, check access code (even if validated via HTTP, double check here)
				if (
					game.accessCode &&
					!isRoomOwner &&
					game.accessCode !== providedAccessCode
				) {
					return callback({
						success: false,
						message: "Invalid access code for private room.",
					});
				}

				if (game.gameStatus === "playing") {
					publicGameState.currentRound = game.currentRound;
					publicGameState.maxRounds = game.maxRounds;
					publicGameState.drawerId = game.drawerId;
					publicGameState.drawingPaths = game.drawingPaths;
					publicGameState.roundEndTime = game.roundEndTime;
					publicGameState.gameStatus = game.gameStatus;
					// Do NOT send the keyword!
				}

				let userIdExists = isAuthenticated
					? game.players.find((p) => p.dbUserId === joiningUserId)
					: game.players.find((p) => p.id === socket.id);

				if (userIdExists) {
					const player = userIdExists;
					socket.join(roomId);
					console.log(
						`User ${player.username} (Socket: ${socket.id}) re-confirmed in room ${roomId}.`
					);
					callback({ success: true, game: publicGameState });
					return;
				}

				if (game.players.length >= game.maxPlayers) {
					return callback({ success: false, message: "Room is full." });
				}

				const newPlayer = {
					id: socket.id,
					username: joiningUsername,
					dbUserId: joiningUserId,
				};
				game.players.push(newPlayer);
				const scoreKey = isAuthenticated ? joiningUserId : socket.id;
				game.scores[scoreKey] = 0;
				socket.join(roomId);
				console.log(
					`User ${socket.id} (username: ${joiningUsername}) joined room ${roomId}.`
				);

				callback({ success: true, game: publicGameState });

				io.to(roomId).emit("update_game", {
					players: game.players,
					drawerId: game.drawerId,
					drawingPaths: game.drawingPaths,
				});
				socket.emit("drawer_queue_updated", {
					drawerQueue: (game.drawerQueue || []).map((p) => ({
						username: p.username,
						socketId: p.socketId,
					})),
				});
				io.to(roomId).emit("new_chat_message", {
					user: "System",
					text: `${newPlayer.username} has connected.`,
				});
			} catch (error) {
				console.error(`Error in socket join_room for room ${roomId}:`, error);
				callback({
					success: false,
					message: "Failed to join room via socket.",
				});
			}

			// Po dodaniu gracza sprawdź, czy to drugi gracz (anuluj timer)
			if (game.players.length === 2 && game.singlePlayerTimer) {
				clearTimeout(game.singlePlayerTimer);
				game.singlePlayerTimer = null;
				io.to(roomId).emit("new_chat_message", {
					user: "System",
					text: `Another player has joined! The game can continue.`,
					type: "system",
				});
			}
		}
	);

	socket.on("drawing_update", ({ roomId, paths }) => {
		const game = games[roomId];
		console.log(
			`Backend: Received drawing_update from ${socket.id} for room ${roomId}. Paths count: ${paths?.length}`
		); // Log receipt
		if (game && game.drawerId === socket.id) {
			// Make sure we're storing the exact paths array (not a reference that might be mutated)
			game.drawingPaths = Array.isArray(paths) ? [...paths] : []; // Clone the array or use empty array as fallback
			console.log(
				`Backend: Broadcasting drawing_data_broadcast to room ${roomId}. Paths count: ${paths?.length}`
			); // Log broadcast
			socket.broadcast.to(roomId).emit("drawing_data_broadcast", { paths });
		}
	});

	socket.on("join_drawer_queue", ({ roomId, token }, callback) => {
		const game = games[roomId];
		let username = `Guest-${socket.id.substring(0, 4)}`;
		if (token) {
			const decoded = jwt.verify(token, JWT_SECRET);
			playerId = decoded.userId;
			username = decoded.username;
		}
		if (!game.drawerQueue) {
			game.drawerQueue = [];
		}
		const isInQueue = game.drawerQueue.some(
			(queuedPlayer) => queuedPlayer.socketId === socket.id
		);
		if (isInQueue) {
			// Remove from queue
			game.drawerQueue = game.drawerQueue.filter(
				(queuedPlayer) => queuedPlayer.socketId !== socket.id
			);
			io.to(roomId).emit("drawer_queue_updated", {
				drawerQueue: game.drawerQueue.map((p) => ({
					username: p.username,
					socketId: p.socketId,
				})),
			});
			callback({
				success: true,
				action: "removed",
				message: "Removed from drawer queue",
			});
		} else {
			const roundsLeft = game.maxRounds - game.currentRound;
			if (game.drawerQueue.length >= roundsLeft) {
				return callback({
					success: false,
					message: `Queue is full. Only ${roundsLeft} rounds remaining.`,
				});
			}
			game.drawerQueue.push({
				socketId: socket.id,
				dbUserId: token ? playerId : null,
				username: username,
			});

			// Broadcast updated queue
			io.to(roomId).emit("drawer_queue_updated", {
				drawerQueue: game.drawerQueue.map((p) => ({
					username: p.username,
					socketId: p.socketId,
				})),
			});

			callback({
				success: true,
				action: "added",
				message: "Added to drawer queue",
			});
		}
	});

	socket.on("select_word", ({ roomId, selectedWord }, callback) => {
		const game = games[roomId];
		if (!game) {
			return callback({ success: false, message: "Room not found" });
		}

		// Select the word and start the round
		selectWordForRound(roomId, selectedWord);

		callback({ success: true, message: "Word selected successfully" });
	});

	socket.on("send_chat_message", ({ roomId, text, token }) => {
		const game = games[roomId];
		let senderUsername = `Guest-${socket.id.substring(0, 4)}`;
		let senderId = socket.id; // Default to socket ID for guests
		let senderDbId = null; // Track database ID separately
		let isAuthenticated = false;

		if (token) {
			try {
				const decoded = jwt.verify(token, JWT_SECRET);
				senderUsername = decoded.username;
				isAuthenticated = true;
				senderDbId = decoded.userId; // Store database ID separately
			} catch (e) {
				/* guest */
			}
		}

		if (!isAuthenticated) {
			// Fallback for guests already in game.players
			const playerInGame = game.players.find((p) => p.id === socket.id);
			if (playerInGame) {
				senderUsername = playerInGame.username;
				// senderId remains socket.id for guests
			}
		}

		const messageData = { user: senderUsername, text, timestamp: new Date() };

		if (game.gameStatus === "playing") {
			if (
				game.keyword &&
				text.toLowerCase().trim() === game.keyword.toLowerCase().trim()
			) {
				// Correct guess logic
				game.round_history[game.currentRound].correct_guesses.push(senderId);
				game.round_history[game.currentRound].all_guesses[senderId] = text;
				correct_guess(roomId, senderId, senderDbId, isAuthenticated);
			} else {
				game.round_history[game.currentRound].all_guesses[senderId] = text;
				io.to(roomId).emit("new_chat_message", messageData);
			}
		} else {
			io.to(roomId).emit("new_chat_message", messageData);
		}
	});

	function endRound(roomId, reason = "timer", senderId) {
		const game = games[roomId];
		if (!game) {
			console.log(`Cannot end round: Room ${roomId} no longer exists`);
			return;
		}

		// Clear the round timer if it exists
		if (game.roundTimer) {
			clearTimeout(game.roundTimer);
			game.roundTimer = null;
		}

		io.to(roomId).emit("new_chat_message", {
			user: "System",
			text: `Round ${game.currentRound} ended! Reason : ${reason}. The word was "${game.keyword}". New round starting soon...`,
		});

		io.to(roomId).emit("end_round", {
			gameStatus: "betweenRounds",
		});

		// Check if game should end
		if (game.gameMode === "rounds" && game.currentRound >= game.maxRounds) {
			endGame(roomId, game.currentRound);
		} else {
			// Start next round after a short delay (e.g., 8 seconds)
			setTimeout(() => startNewRound(roomId), 8000);
		}
	}

	function endGame(roomId, currentRound = null) {
		const game = games[roomId];
		if (!game) {
			console.log(`Cannot end game: Room ${roomId} no longer exists`);
			return;
		}

		const roundToReport = currentRound || game.currentRound;

		// Zatrzymaj timer rundy jeśli istnieje
		if (game.roundTimer) {
			clearTimeout(game.roundTimer);
			game.roundTimer = null;
		}

		// Zmień status gry
		game.gameStatus = "ended";

		// Znajdź zwycięzcę (gracz z najwyższym wynikiem)
		let highestScore = 0;
		let winner = null;

		Object.entries(game.scores).forEach(([playerId, score]) => {
			if (score > highestScore) {
				highestScore = score;
				winner = playerId;
			}
		});

		// Znajdź nazwę zwycięzcy
		let winnerName = "Unknown";
		if (winner) {
			// Szukaj najpierw po socket.id, potem po dbUserId
			const winnerPlayer = game.players.find(
				(p) => p.id === winner || p.dbUserId === winner
			);
			if (winnerPlayer) {
				winnerName = winnerPlayer.username;
			}
		}

		// Wyślij wiadomość o końcu gry
		io.to(roomId).emit("new_chat_message", {
			user: "System",
			text: `Game ended! Winner: ${winnerName}, score: ${highestScore} points.`,
			type: "game_end",
		});

		// Wyślij event o końcu gry z końcowymi wynikami
		io.to(roomId).emit("game_ended", {
			scores: game.scores,
			winner: {
				id: winner,
				name: winnerName,
				score: highestScore,
			},
			gameStats: {
				rounds: roundToReport,
				totalTime: Date.now() - game.startTime,
			},
		});
		setTimeout(async () => {
			// Rozłącz wszystkie sockety w pokoju
			await disconnectRoomSockets(roomId);

			// Usuń pokój z pamięci
			delete games[roomId];

			// Oznacz pokój jako nieaktywny w bazie danych
			await deleteRoomFromDatabase(roomId);
		}, 10000); // 10 sekund na wyświetlenie wyników
	}
	// If the guess is correct, update the game state and notify players
	function correct_guess(
		roomId,
		socketId,
		dbUserId = null,
		isAuthenticated = false
	) {
		const game = games[roomId];
		let guesser = game.players.find((p) => p.id === socketId);
		// Update the scores
		const scoreKey = isAuthenticated && dbUserId ? dbUserId : socketId;
		game.scores[scoreKey] = (game.scores[scoreKey] || 0) + 1;

		// 1. Special message only to the guesser
		io.to(socketId).emit("new_chat_message", {
			user: "System",
			text: `Correct! You guessed the word: ${game.keyword}!`,
			type: "correct_guess",
		});

		// 2. Notify all others (including drawer) but not the guesser
		socket.broadcast.to(roomId).emit("new_chat_message", {
			user: "System",
			text: `${guesser ? guesser.username : "Someone"} has guessed the word!`,
			type: "other_correct",
		});

		// 3. Update guessed to disable chat for the guesser
		io.to(socketId).emit("update_guessed");

		// 4. Check if that means end of the game
		if (
			game.gameMode === "points" &&
			game.scores[scoreKey] >= game.pointsToWin
		) {
			endGame(roomId, scoreKey);
		}

		// 5. Check if all guessers have guessed correctly - FIXED logic
		const allGuessers = game.players.filter((p) => p.id !== game.drawerId);
		const correctGuessers =
			game.round_history[game.currentRound].correct_guesses;
		console.log(
			`All guessers: ${allGuessers.map((p) => p.username).join(", ")}`
		);
		console.log(`Correct guessers: ${correctGuessers.join(", ")}`);
		console.log(`drawerId: ${game.drawerId}`);

		// Fixed: properly check if every guesser has correctly guessed
		const allGuessedCorrectly = allGuessers.every((p) => {
			return (
				correctGuessers.includes(p.id) ||
				(p.dbUserId && correctGuessers.includes(p.dbUserId))
			);
		});

		if (allGuessers.length > 0 && allGuessedCorrectly) {
			endRound(roomId, "all_guessed");
		}
	}

	async function startNewRound(roomId) {
		const game = games[roomId];

		// Sprawdź czy pokój istnieje
		if (!game) {
			console.log(`Cannot start new round: Room ${roomId} no longer exists`);
			return; // Wyjdź z funkcji jeśli pokój nie istnieje
		}

		game.drawingPaths = [];
		game.currentRound += 1;
		game.drawerId = getDrawer(roomId);
		//game.keyword = await getRandomKeyword();
		game.wordChoices = await getRandomKeywords(3);
		game.keyword = null; // Will be set when drawer chooses
		game.wordChoiceDeadline = Date.now() + 10000; // 10 seconds to choose
		console.log(
			`Starting new round ${game.currentRound} in room ${roomId}. Drawer: ${game.drawerId}, Keyword: ${game.keyword}`
		);
		game.round_history[game.currentRound] = {
			drawerId: game.drawerId,
			keyword: game.keyword,
			correct_guesses: [], // socketIDs
			all_guesses: {}, // socketId --> guess
		};
		// // Set round end time
		// const roundDurationMs = game.roundDuration * 1000;
		// game.roundEndTime = Date.now() + roundDurationMs;

		// if (game.roundTimer) clearTimeout(game.roundTimer);
		// game.roundTimer = setTimeout(() => endRound(roomId), roundDurationMs);

		// // Emit new_round with roundEndTime - FIXED: removed duplicate currentRound
		// io.to(roomId).emit("new_round", {
		// 	drawingPaths: [],
		// 	currentRound: game.currentRound,
		// 	maxRounds: game.maxRounds,
		// 	drawerId: game.drawerId,
		// 	roundEndTime: game.roundEndTime,
		// 	gameStatus: "playing",
		// });

		// io.to(game.drawerId).emit("new_keyword", { keyword: game.keyword });

		// Set word choice timer (15 seconds)
		if (game.wordChoiceTimer) clearTimeout(game.wordChoiceTimer);
		game.wordChoiceTimer = setTimeout(() => {
			// Auto-select first word if no choice made
			if (!game.keyword && game.wordChoices && game.wordChoices.length > 0) {
				selectWordForRound(roomId, game.wordChoices[0]);
			}
		}, 10000);

		// Emit word choice event to drawer
		io.to(game.drawerId).emit("choose_word", {
			wordChoices: game.wordChoices,
			deadline: game.wordChoiceDeadline,
		});

		// Emit round preparation to all players
		io.to(roomId).emit("round_preparation", {
			currentRound: game.currentRound,
			maxRounds: game.maxRounds,
			drawerId: game.drawerId,
			gameStatus: "choosing_word",
		});

		// Broadcast updated queue if using queue mode
		if (game.drawerChoice === "queue" && game.drawerQueue) {
			io.to(roomId).emit("drawer_queue_updated", {
				drawerQueue: game.drawerQueue.map((p) => ({
					username: p.username,
					socketId: p.socketId,
				})),
			});
		}
	}

	socket.on("end_game", ({ roomId }) => {});

	socket.on("start_game", ({ roomId }, callback) => {
		const game = games[roomId];
		game.gameStatus = "playing";
		game.currentRound = 0;
		game.startTime = Date.now(); // Dodaj tę linię
		startNewRound(roomId);
		// Notify everyone that the game is starting
		io.to(roomId).emit("game_started");
		callback({ gameStatus: "playing" });
	});

	socket.on("disconnect", async () => {
		console.log("Socket disconnected:", socket.id);
		const roomId = socket.roomId;
		const game = games[roomId];
		if (!game) {
			console.warn(`No game found for room ${roomId}.`);
			return;
		}

		// Usuń gracza z listy (bez zmian)
		const playerIndex = game.players.findIndex((p) => p.id === socket.id);

		if (playerIndex !== -1) {
			const removedPlayer = game.players.splice(playerIndex, 1)[0];

			// Powiadom pozostałych graczy (bez zmian)
			io.to(roomId).emit("new_chat_message", {
				user: "System",
				text: `${removedPlayer.username} has disconnected.`,
			});

			io.to(roomId).emit("update_game", {
				players: game.players,
				drawerId: game.drawerId,
				drawingPaths: game.drawingPaths,
			});

			// Obsługa rysującego (bez zmian)
			if (game.drawerId === removedPlayer.id) {
				console.log(`Drawer ${removedPlayer.username} disconnected`);
				if (game.gameStatus === "playing") {
					endRound(roomId, "drawer_left");
				}
			}

			// DODAJ SPRAWDZENIE FLAGI - nie wykonuj dodatkowych operacji jeśli pokój jest właśnie niszczony
			if (game.being_destroyed) {
				console.log(
					`Room ${roomId} is being destroyed, skipping cleanup in disconnect handler.`
				);
				return;
			}

			// Sprawdź czy został tylko jeden gracz
			if (game.players.length === 1) {
				handleSinglePlayerRoom(roomId);
			}
			// Sprawdź czy pokój jest pusty
			else if (game.players.length === 0) {
				console.log(
					`Room ${roomId} is empty. Cleaning up from database and memory.`
				);
				await deleteRoomFromDatabase(roomId);
				delete games[roomId];
			}
		} else {
			console.log(
				`Player with socket ID ${socket.id} not found in room ${roomId}`
			);
		}
	});

	socket.on("destroy_room", async ({ roomId }, callback) => {
		try {
			console.log(`User ${socket.id} attempting to destroy room ${roomId}`);

			const game = games[roomId];
			if (!game) {
				return callback?.({ success: false, message: "Room not found" });
			}

			// Sprawdzenie, czy użytkownik jest właścicielem (bez zmian)
			const isOwner = game.ownerId === socket.id;
			const player = game.players.find((p) => p.id === socket.id);
			const isLoggedInOwner =
				player && player.dbUserId && player.dbUserId === game.ownerId;

			if (!isOwner && !isLoggedInOwner) {
				return callback?.({
					success: false,
					message: "Only room owner can destroy the room",
				});
			}

			// DODAJ FLAGĘ - oznacz pokój jako właśnie niszczony
			game.being_destroyed = true;

			// ZATRZYMAJ WSZYSTKIE TIMERY
			if (game.roundTimer) {
				clearTimeout(game.roundTimer);
				game.roundTimer = null;
			}

			if (game.singlePlayerTimer) {
				clearTimeout(game.singlePlayerTimer);
				game.singlePlayerTimer = null;
			}

			// Powiadomienia (bez zmian)
			io.to(roomId).emit("new_chat_message", {
				user: "System",
				text: `Room owner has closed the room. All players will be disconnected.`,
				type: "system",
			});

			io.to(roomId).emit("room_destroyed");

			// Najpierw usuń pokój z bazy danych
			await deleteRoomFromDatabase(roomId);

			// Teraz rozłącz sockety
			await disconnectRoomSockets(roomId);

			// Usuń pokój z pamięci
			delete games[roomId];

			callback?.({ success: true });
		} catch (error) {
			console.error(`Error destroying room ${roomId}:`, error);
			callback?.({ success: false, message: "Failed to destroy room" });
		}
	});

	// Handler dla zdarzenia 'leave_game'
	socket.on("leave_game", async ({ roomId }, callback) => {
		try {
			console.log(`User ${socket.id} attempting to leave room ${roomId}`);

			const game = games[roomId];
			if (!game) {
				return callback?.({ success: false, message: "Room not found" });
			}

			// Sprawdź czy gracz jest właścicielem - jeśli tak, zablokuj wyjście przez leave_game
			const player = game.players.find((p) => p.id === socket.id);
			const isOwner =
				game.ownerId === socket.id ||
				(player?.dbUserId && player.dbUserId === game.ownerId);

			if (isOwner) {
				return callback?.({
					success: false,
					message:
						'Room owner cannot leave the room. Use "Destroy Room" instead.',
				});
			}

			// Reszta kodu bez zmian...
			const playerIndex = game.players.findIndex((p) => p.id === socket.id);
			if (playerIndex === -1) {
				return callback?.({
					success: false,
					message: "Player not found in room",
				});
			}

			// Usuń gracza z pokoju
			const removedPlayer = game.players[playerIndex];
			game.players.splice(playerIndex, 1);

			// Opuść pokój Socket.IO
			socket.leave(roomId);
			socket.roomId = null;

			// Powiadom innych graczy
			io.to(roomId).emit("new_chat_message", {
				user: "System",
				text: `${removedPlayer.username} has left the game.`,
			});

			// Aktualizuj listę graczy
			io.to(roomId).emit("update_game", {
				players: game.players,
				drawerId: game.drawerId,
				drawingPaths: game.drawingPaths,
			});

			// Jeśli opuszczający jest rysującym, obsłuż to specjalnie
			if (game.drawerId === removedPlayer.id && game.gameStatus === "playing") {
				endRound(roomId, "drawer_left");
			}

			// Sprawdź czy został tylko jeden gracz
			if (game.players.length === 1) {
				handleSinglePlayerRoom(roomId);
			}

			// Jeśli pokój jest pusty, usuń go
			else if (game.players.length === 0) {
				console.log(`Room ${roomId} is empty after player left. Cleaning up.`);
				await deleteRoomFromDatabase(roomId);
				delete games[roomId];
			}

			callback?.({ success: true });
		} catch (error) {
			console.error(`Error leaving room ${roomId}:`, error);
			callback?.({ success: false, message: "Failed to leave room" });
		}
	});
});

app.get("/api/ping", (req, res) => {
	res.send("pong");
});

app.post("/admin/disconnect-all", (req, res) => {
	io.sockets.sockets.forEach((socket) => {
		console.log(`Socket disconnected ${socket.id}`);
		socket.disconnect(true);
	});
	res.send("All sockets disconnected.");
	// Dodaj obsługę zdarzenia destroy_room
});
// curl -X POST http://localhost:4000/admin/disconnect-all

const PORT = 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

function handleSinglePlayerRoom(roomId) {
	const game = games[roomId];
	if (!game || game.players.length !== 1) return;

	const lastPlayer = game.players[0];

	// Jeśli gra jest w trakcie, przerwij ją
	if (game.gameStatus === "playing") {
		if (game.roundTimer) clearTimeout(game.roundTimer);
		game.gameStatus = "waiting";
	}

	// Powiadom gracza, że został sam
	io.to(lastPlayer.id).emit("new_chat_message", {
		user: "System",
		text: `You are the only player left. The room will be closed in 60 seconds if no one joins.`,
		type: "warning",
	});

	// Ustaw flagę i timer
	if (game.singlePlayerTimer) clearTimeout(game.singlePlayerTimer);

	game.singlePlayerTimer = setTimeout(async () => {
		// Sprawdź czy nadal jest tylko jeden gracz
		if (game.players.length === 1) {
			io.to(lastPlayer.id).emit("new_chat_message", {
				user: "System",
				text: `Room is closing due to inactivity. You will be redirected to the home page.`,
				type: "system",
			});

			// ZMIANA: Używamy istniejącego wydarzenia room_destroyed zamiast tworzyć nowe
			io.to(roomId).emit("room_destroyed");

			// Rozłącz ostatniego gracza
			const socket = Array.from(io.sockets.sockets.values()).find(
				(s) => s.id === lastPlayer.id
			);
			if (socket) socket.disconnect(true);

			// Usuń pokój
			await deleteRoomFromDatabase(roomId);
			delete games[roomId];
		}
	}, 60000); // 60 sekund
}

// Najpierw szukaj po dbUserId
const getOwnerUsername = () => {
	// Najpierw szukaj po dbUserId
	const ownerPlayer = game.players.find((p) => p.dbUserId === game.ownerId);

	if (ownerPlayer) {
		return ownerPlayer.username;
	}

	// Jeśli nie znaleziono, szukaj po socket.id
	const ownerBySocketId = game.players.find((p) => p.id === game.ownerId);
	if (ownerBySocketId) {
		return ownerBySocketId.username;
	}

	// Jeśli nadal nie znaleziono, pokaż ID właściciela lub domyślną wartość
	return game.ownerUsername || "Unknown";
};
