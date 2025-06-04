"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import io from "socket.io-client";
import { ReactSketchCanvas } from "react-sketch-canvas";
import { jwtDecode } from "jwt-decode";
import GameEndPopup from "../../components/GameEndPopup";

export default function GamePage() {
	// TODO: Change logic to rely on the game object in memory.
	// Game state variables stored inside a copy of the game object from backend
	const [game, setGame] = useState({});
	const [currentSocketId, setCurrentSocketId] = useState(null);

	// Canvas variables
	const canvasRef = useRef(null);
	const socketRef = useRef(null);
	const [eraseMode, setEraseMode] = useState(false);
	const [strokeWidth, setStrokeWidth] = useState(5);
	const [eraserWidth, setEraserWidth] = useState(10);
	const [strokeColor, setStrokeColor] = useState("#000000");
	const [canvasColor, setCanvasColor] = useState("#ffffff");

	// Routing variables
	const router = useRouter();
	const params = useParams();
	const queryParams = useSearchParams();

	// Game and chat variables
	const [roomId, setRoomId] = useState(null);
	const [isDrawer, setIsDrawer] = useState(false);
	const [isRoomOwner, setIsRoomOwner] = useState(false);
	const [roomOwner, setRoomOwner] = useState(null);
	const isDrawerRef = useRef(isDrawer); // Ref to hold the latest isDrawer state for callbacks
	const [loggedInUser, setLoggedInUser] = useState(null);
	const [accessCodeInput, setAccessCodeInput] = useState("");
	const [requiresAccessCode, setRequiresAccessCode] = useState(false);
	const [joinedRoom, setJoinedRoom] = useState(false);
	const [chatMessages, setChatMessages] = useState([]);
	const [chatInput, setChatInput] = useState("");
	const [canStartGame, setCanStartGame] = useState(true);
	const [hasGuessedCorrectly, setHasGuessedCorrectly] = useState(false);
	const [roundEndTime, setRoundEndTime] = useState(null);
	const [secondsLeft, setSecondsLeft] = useState(null);
	const timerIntervalRef = useRef(null);
	const [nextRoundSeconds, setNextRoundSeconds] = useState(null);
	const nextRoundTimerRef = useRef(null);
	const [drawerQueue, setDrawerQueue] = useState([]);
	const [isInQueue, setIsInQueue] = useState(false);
	const [queueMessage, setQueueMessage] = useState("");
	const [gameEndData, setGameEndData] = useState(null);
	const [wordChoices, setWordChoices] = useState([]);
	const [wordChoiceDeadline, setWordChoiceDeadline] = useState(null);
	const [wordChoiceTimeLeft, setWordChoiceTimeLeft] = useState(null);
	const wordChoiceTimerRef = useRef(null);
	const [scores, setScores] = useState({});
	const [lastScorer, setLastScorer] = useState(null);
	const [roundSummary, setRoundSummary] = useState(null);

	// function to retrieve roomID
	useEffect(() => {
		setRoomId(params.roomId);
		const newSocket = io(
			process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"
		);
		socketRef.current = newSocket;

		newSocket.on("connect", () => {
			setCurrentSocketId(newSocket.id); // Signal that socket is connected and ready
		});

		newSocket.on("disconnect", () => {
			socketRef.current = null;
			setCurrentSocketId(null);
		});

		// connect, disconnect
		// game started, new round, time is over
		// chat message
		// join room, leave room

		newSocket.on("game_started", () => {
			// Only add one system message - don't add messages about the word here
			setChatMessages((prev) => [
				...prev,
				{
					user: "System",
					text: "The game has started!",
					type: "game_event",
				},
			]);
		});

		newSocket.on("update_game", (data) => {
			setGame((prev) => ({
				...prev,
				players: data.players,
				drawerId: data.drawerId,
				drawingPaths: data.drawingPaths,
			}));
		});

		newSocket.on("score_update", (data) => {
			setScores(data.scores);
			setLastScorer(data.lastScorer);

			// Clear last scorer highlight after 3 seconds
			setTimeout(() => setLastScorer(null), 3000);
		});

		newSocket.on("end_round", (data) => {
			setRoundSummary(data.roundSummary);
			setScores(data.roundSummary.scores);
			setRoundEndTime(null);
			setSecondsLeft(null);
			clearInterval(timerIntervalRef.current);
			setGame((prev) => ({
				...prev,
				gameStatus: data.gameStatus,
			}));
			setNextRoundSeconds(3); // 3 seconds until next round
			nextRoundTimerRef.current = setInterval(() => {
				setNextRoundSeconds((prev) => {
					if (prev === 1) {
						clearInterval(nextRoundTimerRef.current);
						return null;
					}
					return prev - 1;
				});
			}, 1000);
		});

		newSocket.on("new_round", (data) => {
			if (nextRoundTimerRef.current) {
				clearInterval(nextRoundTimerRef.current);
				setNextRoundSeconds(null);
			}
			// Clear word choice state
			setWordChoices([]);
			setWordChoiceDeadline(null);
			setWordChoiceTimeLeft(null);

			setGame((prev) => ({
				...prev,
				drawingPaths: [],
				currentRound: data.currentRound,
				drawerId: data.drawerId,
				keyword: data.keyword,
				maxRounds: data.maxRounds,
				gameStatus: data.gameStatus,
			}));
			data.drawerId === newSocket.id ? setIsDrawer(true) : setIsDrawer(false);
			setHasGuessedCorrectly(false);
			setRoundEndTime(data.roundEndTime);
			if (canvasRef.current) {
				canvasRef.current.resetCanvas();
			}
		});

		newSocket.on("choose_word", (data) => {
			setWordChoices(data.wordChoices);
			setWordChoiceDeadline(data.deadline);
			setGame((prev) => ({ ...prev, gameStatus: "choosing_word" }));
		});

		newSocket.on("round_preparation", (data) => {
			setGame((prev) => ({
				...prev,
				currentRound: data.currentRound,
				maxRounds: data.maxRounds,
				drawerId: data.drawerId,
				gameStatus: data.gameStatus,
			}));

			const newIsDrawer = data.drawerId === newSocket.id;
			setIsDrawer(newIsDrawer);
			isDrawerRef.current = newIsDrawer;

			// Clear previous word choices if not the drawer
			if (!newIsDrawer) {
				setWordChoices([]);
				setWordChoiceDeadline(null);
			}
		});

		newSocket.on("new_keyword", (data) => {
			setGame((prev) => ({
				...prev,
				keyword: data.keyword,
				wordDifficulty: data.difficulty,
				drawerBasePoints: data.basePoints,
			}));
		});

		// OK
		newSocket.on("new_chat_message", (data) => {
			setChatMessages((prevMessages) => [...prevMessages, data]);
		});

		newSocket.on("update_guessed", () => {
			setHasGuessedCorrectly(true);
		});

		// OK
		newSocket.on("drawing_data_broadcast", (data) => {
			if (!isDrawerRef.current && canvasRef.current) {
				// Use ref for current isDrawer status
				canvasRef.current.clearCanvas();
				canvasRef.current.loadPaths(data.paths);
			}
		});

		newSocket.on("drawer_queue_updated", (data) => {
			setDrawerQueue(data.drawerQueue);

			// Check if current player is in queue
			const currentPlayerInQueue = data.drawerQueue.some(
				(player) => player.socketId === currentSocketId
			);
			setIsInQueue(currentPlayerInQueue);
		});

		newSocket.on("game_ended", (data) => {
			console.log("Game ended with data:", data);
			setGameEndData(data);
		});

		newSocket.on("room_destroyed", () => {
			alert(
				"The room owner has closed this room. You will be redirected to the home page."
			);
			router.push("/");
		});

		// Cleanup all event listeners and disconnect socket
		return () => {
			newSocket.off("game_started");
			newSocket.off("update_game");
			newSocket.off("end_round");
			newSocket.off("new_round");
			newSocket.off("new_keyword");
			newSocket.off("new_chat_message");
			newSocket.off("update_guessed");
			newSocket.off("drawing_data_broadcast");
			newSocket.off("game_ended");
			newSocket.off("room_destroyed");
			newSocket.off("drawer_queue_updated");
			newSocket.off("choose_word");
			newSocket.off("round_preparation");
			newSocket.off("score_update");
			newSocket.off("end_round");

			if (socketRef.current) {
				socketRef.current.disconnect();
				socketRef.current = null;
				setCurrentSocketId(null);
			}
		};
	}, [params.roomId]); // Only re-run if roomId changes or on mount/unmount

	// Helper function to get difficulty stars
	const getDifficultyStars = (difficulty) => {
		return "★".repeat(difficulty) + "☆".repeat(5 - difficulty);
	};

	// Helper function to format scores display
	const getFormattedScores = () => {
		if (!game.players || Object.keys(scores).length === 0) return [];

		return game.players
			.map((player) => {
				const scoreKey = player.dbUserId || player.id;
				const score = scores[scoreKey] || 0;
				const isLastScorer =
					lastScorer &&
					(lastScorer.username === player.username ||
						(lastScorer.isDrawer && game.drawerId === player.id));

				return {
					...player,
					score,
					isLastScorer,
					isCurrentDrawer: game.drawerId === player.id,
				};
			})
			.sort((a, b) => b.score - a.score); // Sort by score descending
	};

	// Add word choice timer effect
	useEffect(() => {
		if (!wordChoiceDeadline) {
			setWordChoiceTimeLeft(null);
			if (wordChoiceTimerRef.current) {
				clearInterval(wordChoiceTimerRef.current);
			}
			return;
		}

		function updateWordChoiceTimer() {
			const now = Date.now();
			const diff = Math.max(0, Math.floor((wordChoiceDeadline - now) / 1000));
			setWordChoiceTimeLeft(diff);

			if (diff === 0) {
				clearInterval(wordChoiceTimerRef.current);
			}
		}

		updateWordChoiceTimer();
		wordChoiceTimerRef.current = setInterval(updateWordChoiceTimer, 1000);

		return () => {
			if (wordChoiceTimerRef.current) {
				clearInterval(wordChoiceTimerRef.current);
			}
		};
	}, [wordChoiceDeadline]);

	// Local timer for countdown display
	useEffect(() => {
		if (!roundEndTime) {
			setSecondsLeft(null);
			return;
		}
		function updateTimer() {
			const now = Date.now();
			const diff = Math.max(0, Math.floor((roundEndTime - now) / 1000));
			setSecondsLeft(diff);
		}
		updateTimer();
		timerIntervalRef.current = setInterval(updateTimer, 250);
		return () => clearInterval(timerIntervalRef.current);
	}, [roundEndTime]);

	useEffect(() => {
		if (!isDrawer) {
			setGame((prev) => ({
				...prev,
				drawingPaths: [],
				keyword: null,
			}));
		}
		isDrawerRef.current = isDrawer;
	}, [isDrawer]); // Only re-run if isDrawer changes

	useEffect(() => {
		// Only update for guessers (not the drawer)
		if (!isDrawer && canvasRef.current && game.drawingPaths) {
			canvasRef.current.clearCanvas();
			if (game.drawingPaths.length > 0) {
				canvasRef.current.loadPaths(game.drawingPaths);
			}
		}
	}, [game.drawingPaths, isDrawer]);

	// should be handled by backend?
	useEffect(() => {
		const token = localStorage.getItem("jwtToken");
		if (token) {
			try {
				const decoded = jwtDecode(token);
				setLoggedInUser({ username: decoded.username, userId: decoded.userId });
				decoded.userId === game.ownerId
					? setIsRoomOwner(true)
					: setIsRoomOwner(false);
			} catch (e) {
				console.error("Failed to decode token on game page", e);
				localStorage.removeItem("jwtToken");
			}
		}

		// Determine if access code is required
		const isPrivateRoom = queryParams.get("private") === "true";
		if (roomId && isPrivateRoom && !joinedRoom && !accessCodeInput.trim()) {
			// If private, not joined, and no code entered yet
			setRequiresAccessCode(true);
		} else {
			setRequiresAccessCode(false); // Not private, or already joined, or code has been input
		}

		// Attempt to join if conditions are met
		if (currentSocketId && roomId && !joinedRoom) {
			// Check currentSocketId to ensure socket is connected
			if (!isPrivateRoom || (isPrivateRoom && accessCodeInput.trim())) {
				// If not private, or private and code is provided
				attemptJoinRoom(socketRef.current, roomId, token, accessCodeInput);
			}
		}
	}, [roomId, currentSocketId, joinedRoom, queryParams]);

	// OK
	const handleStartGame = () => {
		if (
			isRoomOwner &&
			socketRef.current &&
			socketRef.current.connected &&
			roomId
		) {
			socketRef.current.emit("start_game", { roomId }, (response) => {
				setGame((prev) => ({
					...prev,
					gameStatus: response.gameStatus,
				}));
			});
			setCanStartGame(false);
		}
	};

	// Add word selection handler
	const handleWordSelection = (selectedWord) => {
		if (!socketRef.current || !roomId) return;

		socketRef.current.emit(
			"select_word",
			{ roomId, selectedWord },
			(response) => {
				if (!response.success) {
					console.error("Failed to select word:", response.message);
				}
			}
		);
	};

	// Helper function to get difficulty label
	const getDifficultyLabel = (difficulty) => {
		const labels = {
			1: "Easy",
			2: "Medium",
			3: "Hard",
			4: "Very Hard",
			5: "Expert",
		};
		return labels[difficulty] || "Unknown";
	};

	// Helper function to get difficulty color
	const getDifficultyColor = (difficulty) => {
		const colors = {
			1: "#4caf50", // Green
			2: "#ff9800", // Orange
			3: "#f44336", // Red
			4: "#9c27b0", // Purple
			5: "#e91e63", // Pink
		};
		return colors[difficulty] || "#666";
	};

	const attemptJoinRoom = (socketInstance, rId, token, code) => {
		if (!socketInstance || !socketInstance.connected) {
			console.warn("AttemptJoinRoom called but socket not connected.");
			return;
		}
		socketInstance.emit(
			"join_room",
			{
				roomId: rId,
				token: token,
				accessCode: code,
			},
			(response) => {
				if (response.success) {
					setJoinedRoom(true);
					setRequiresAccessCode(false);
					setChatMessages((prev) => [
						...prev,
						{ user: "System", text: `You joined room ${rId}.` },
					]);
					setGame(response.game);
					if (response.game.gameStatus === "playing") {
						setRoundEndTime(response.game.roundEndTime);
						if (canvasRef.current && response.game.drawingPaths) {
							canvasRef.current.clearCanvas();
							if (response.game.drawingPaths.length > 0) {
								canvasRef.current.loadPaths(response.game.drawingPaths);
							}
						}
					}
				} else {
					alert(`Failed to join room: ${response.message}`);
					setJoinedRoom(false); // Ensure joinedRoom is false on failure
					if (!token && response.message?.toLowerCase().includes("token")) {
						router.push(`/login?redirect=/game/${rId}`);
					} else if (response.message?.toLowerCase().includes("access code")) {
						setRequiresAccessCode(true); // Re-prompt if code was wrong
						setAccessCodeInput(""); // Clear wrong code
					} else if (response.message?.toLowerCase().includes("full")) {
						router.push("/"); // Room is full, go to homepage
					} else if (
						response.message?.toLowerCase().includes("not found") ||
						response.message?.toLowerCase().includes("not exist")
					) {
						router.push("/"); // Room doesn't exist or not active
					}
				}
			}
		);
	};

	const handleAccessCodeSubmit = (e) => {
		e.preventDefault();
		if (
			socketRef.current &&
			socketRef.current.connected &&
			roomId &&
			accessCodeInput.trim()
		) {
			const token = localStorage.getItem("jwtToken");
			attemptJoinRoom(socketRef.current, roomId, token, accessCodeInput);
		} else if (!accessCodeInput.trim()) {
			alert("Please enter an access code.");
		} else {
			alert(
				"Not connected to server or room ID miss  g. Please wait or refresh."
			);
		}
	};

	// Add this function to handle queue joining/leaving
	const handleJoinDrawerQueue = () => {
		if (!socketRef.current || !roomId) return;

		const token = localStorage.getItem("jwtToken");

		socketRef.current.emit(
			"join_drawer_queue",
			{ roomId, token },
			(response) => {
				if (response.success) {
					setQueueMessage(response.message);
					setTimeout(() => setQueueMessage(""), 3000); // Clear message after 3 seconds
				} else {
					alert(response.message);
				}
			}
		);
	};

	// Calculate rounds left for display
	const getRoundsLeft = () => {
		if (!game.maxRounds || !game.currentRound) return 0;
		return Math.max(0, game.maxRounds - game.currentRound);
	};

	// OK
	const sendDrawing = (pathsToEmit) => {
		if (
			isDrawerRef.current &&
			roomId &&
			socketRef.current &&
			socketRef.current.connected
		) {
			if (Array.isArray(pathsToEmit)) {
				socketRef.current.emit("drawing_update", {
					roomId,
					paths: pathsToEmit,
				});
			} else {
				console.error(
					"[sendDrawing] Paths from onChange is not a valid array. Not emitting. Paths value:",
					pathsToEmit
				);
			}
		} else {
			console.error(
				"[sendDrawing] Conditions not met for emitting drawing_update (drawer, roomId, socket)."
			);
		}
	};

	// OK
	const handleCanvasChange = (updatedPaths) => {
		if (isDrawerRef.current) {
			//debouncedSendDrawing(updatedPaths);
			sendDrawing(updatedPaths);
		}
	};

	// OK
	const handleSendChatMessage = (e) => {
		e.preventDefault();
		if (
			!chatInput.trim() ||
			!roomId ||
			!socketRef.current ||
			!socketRef.current.connected
		)
			return;
		const token = localStorage.getItem("jwtToken");
		// Send the chat message
		socketRef.current.emit("send_chat_message", {
			roomId: roomId,
			text: chatInput,
			token: token,
		});
		setChatInput("");
	};

	const effectiveReadOnly = !isDrawer;

	// OK
	const handleEraserClick = () => {
		if (!effectiveReadOnly && canvasRef.current) {
			setEraseMode(true);
			canvasRef.current.eraseMode(true);
		}
	};
	const handlePenClick = () => {
		if (!effectiveReadOnly && canvasRef.current) {
			setEraseMode(false);
			canvasRef.current.eraseMode(false);
		}
	};
	const handleStrokeWidthChange = (event) => {
		if (!effectiveReadOnly) setStrokeWidth(+event.target.value);
	};
	const handleEraserWidthChange = (event) => {
		if (!effectiveReadOnly) setEraserWidth(+event.target.value);
	};
	const handleStrokeColorChange = (event) => {
		if (!effectiveReadOnly) setStrokeColor(event.target.value);
	};

	// OK
	const handleUndoClick = async () => {
		if (!effectiveReadOnly && canvasRef.current) {
			await canvasRef.current.undo();

			// Since undo might not trigger onChange, manually get paths and send them
			if (
				isDrawerRef.current &&
				socketRef.current &&
				socketRef.current.connected
			) {
				try {
					const paths = await canvasRef.current.exportPaths();
					// debouncedSendDrawing(paths);
					sendDrawing(paths);
				} catch (error) {
					console.error("Error getting paths after undo:", error);
				}
			}
		}
	};

	// OK
	const handleRedoClick = async () => {
		if (!effectiveReadOnly && canvasRef.current) {
			await canvasRef.current.redo();

			// Since redo might not trigger onChange, manually get paths and send them
			if (
				isDrawerRef.current &&
				socketRef.current &&
				socketRef.current.connected
			) {
				try {
					const paths = await canvasRef.current.exportPaths();
					// debouncedSendDrawing(paths);
					sendDrawing(paths);
				} catch (error) {
					console.error("Error getting paths after redo:", error);
				}
			}
		}
	};

	// OK
	const handleClearClick = async () => {
		if (!effectiveReadOnly && canvasRef.current) {
			await canvasRef.current.clearCanvas();

			// Since clearCanvas might not trigger onChange, manually send empty paths
			if (
				isDrawerRef.current &&
				socketRef.current &&
				socketRef.current.connected
			) {
				// debouncedSendDrawing([]);
				sendDrawing([]);
			}
		}
	};

	// Add this function with your other handler functions in GamePage component
	const handleDestroyRoom = () => {
		if (
			window.confirm(
				"Are you sure you want to destroy this room? All players will be disconnected."
			)
		) {
			if (socketRef.current && socketRef.current.connected && roomId) {
				socketRef.current.emit("destroy_room", { roomId }, (response) => {
					if (response && response.success) {
						console.log("Room successfully destroyed");
						router.push("/");
					} else {
						alert(
							"Failed to destroy room: " +
								(response?.message || "Unknown error")
						);
					}
				});
			} else {
				alert("Not connected to the server. Please try again.");
			}
		}
	};

	const handleLeaveGame = () => {
		if (window.confirm("Are you sure you want to leave this game?")) {
			if (socketRef.current && socketRef.current.connected && roomId) {
				socketRef.current.emit("leave_game", { roomId }, (response) => {
					if (response && response.success) {
						console.log("Successfully left game");
						router.push("/");
					} else {
						const errorMsg = response?.message || "Unknown error";
						alert("Failed to leave game: " + errorMsg);

						// Jeśli próbujemy wyjść jako owner, zasugeruj użycie Destroy Room
						if (errorMsg.includes("owner cannot leave")) {
							alert(
								'As the room owner, please use "Destroy Room" button to close the room.'
							);
						}
					}
				});
			} else {
				router.push("/");
			}
		}
	};

	const getOwnerUsername = () => {
		const ownerPlayer = game.players.find((p) => p.dbUserId === game.ownerId);
		return ownerPlayer ? ownerPlayer.username : "Unknown";
	};

	// JSX
	if (!roomId)
		return (
			<div className="flex justify-center items-center h-screen">
				Loading room ID...
			</div>
		);

	if (requiresAccessCode && !joinedRoom) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-100">
				<div className="p-8 bg-white rounded-lg shadow-xl w-full max-w-md text-black">
					<h2 className="text-2xl font-semibold mb-4">
						Enter Access Code for Room {roomId}
					</h2>
					<form onSubmit={handleAccessCodeSubmit}>
						<input
							type="text"
							value={accessCodeInput}
							onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
							placeholder="Access Code"
							className="w-full px-4 py-3 border border-gray-300 rounded-md mb-4"
						/>
						<button
							type="submit"
							className="w-full py-3 bg-blue-500 text-white rounded-lg"
						>
							Enter Room
						</button>
					</form>
				</div>
			</div>
		);
	}

	if (!currentSocketId && !joinedRoom) {
		// If socket not connected yet and not joined
		return (
			<div className="flex justify-center items-center h-screen">
				Connecting to game server...
			</div>
		);
	}
	if (currentSocketId && !joinedRoom && !requiresAccessCode) {
		// Connected, but not joined, and not waiting for access code
		return (
			<div className="flex justify-center items-center h-screen">
				Joining room {roomId}...
			</div>
		);
	}

	// Main Game UI (only render if joinedRoom is true, or if not requiring access code and socket is connected - though join should happen quickly)
	if (!joinedRoom) {
		// This case should ideally be covered by the above loading/access code states.
		// If it reaches here, it means conditions to join haven't been met or join failed silently.
		return (
			<div className="flex justify-center items-center h-screen">
				Preparing game... Please wait.
			</div>
		);
	}

	// Boilerplate version of the UI, keeping all functionalities, buttons, and layout (2/3 canvas, 1/3 chat)
	return (
		<div
			style={{
				display: "flex",
				height: "100vh",
				gap: "12px",
				background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
				padding: "12px",
				boxSizing: "border-box",
			}}
		>
			{/* Left: Canvas Area (2/3) */}
			<div
				style={{
					flex: 2,
					display: "flex",
					flexDirection: "column",
					background: "#ffffff",
					border: "2px solid #e5e7eb",
					borderRadius: "16px",
					padding: "16px",
					minWidth: 0,
					boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
					overflow: "hidden",
				}}
			>
				{/* Room and Status - USUNIĘTO height: "20%" */}
				<div style={{ 
					marginBottom: "12px", 
					flex: "0 0 auto",
					maxHeight: "50vh",
					overflowY: "auto"
				}}>
					{/* Room info + buttons */}
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: "8px",
							padding: "12px",
							background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
							borderRadius: "12px",
							border: "1px solid #e5e7eb",
						}}
					>
						<div style={{ fontWeight: "600", color: "#374151" }}>
							Room: <span style={{ color: "#1e40af" }}>{game.roomId}</span>, Owner: <span style={{ color: "#059669" }}>{getOwnerUsername()}</span>
						</div>
						<div>
							{/* Przycisk "Leave Game" tylko dla graczy, którzy NIE są właścicielami */}
							{!isRoomOwner && (
								<button
									onClick={handleLeaveGame}
									style={{
										marginRight: "8px",
										background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
										color: "white",
										border: "none",
										padding: "8px 16px",
										borderRadius: "8px",
										fontSize: "14px",
										fontWeight: "500",
										cursor: "pointer",
										boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
									}}
								>
									Leave Game
								</button>
							)}

							{/* Przycisk "Destroy Room" tylko dla właściciela */}
							{isRoomOwner && (
								<button
									onClick={handleDestroyRoom}
									style={{
										background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
										color: "white",
										border: "none",
										padding: "8px 16px",
										borderRadius: "8px",
										fontSize: "14px",
										fontWeight: "500",
										cursor: "pointer",
										boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
									}}
								>
									Destroy Room
								</button>
							)}
						</div>
					</div>

					{/* Start Game button */}
					<div style={{ marginBottom: "8px" }}>
						{isRoomOwner && game.players && game.players.length >= 2 && canStartGame && (
							<button
								onClick={handleStartGame}
								style={{
									background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
									color: "white",
									border: "none",
									padding: "12px 24px",
									borderRadius: "12px",
									fontSize: "16px",
									fontWeight: "600",
									cursor: "pointer",
									boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
								}}
							>
								🚀 Start Game
							</button>
						)}
					</div>

					{/* Status Info Cards */}
					<div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
						<div style={{
							background: game.gameStatus === "playing" ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : 
									 game.gameStatus === "choosing_word" ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" :
									 game.gameStatus === "betweenRounds" ? "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)" :
									 "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
							color: "white",
							padding: "6px 12px",
							borderRadius: "20px",
							fontSize: "12px",
							fontWeight: "500",
						}}>
							{game.gameStatus === "playing" ? (
								isDrawer ? (
									game.keyword ? `🎨 Drawing: ${game.keyword}` : "🎨 Drawing"
								) : (
									"🔍 Guessing"
								)
							) : game.gameStatus === "choosing_word" ? (
								isDrawer ? "🎯 Choose word" : `⏳ Choosing... ${wordChoiceTimeLeft !== null ? `(${wordChoiceTimeLeft}s)` : ""}`
							) : game.gameStatus === "betweenRounds" ? (
								`⏸️ Next round ${nextRoundSeconds !== null ? `(${nextRoundSeconds}s)` : ""}`
							) : (
								"⏸️ Waiting"
							)}
						</div>

						{/* Round Info */}
						{game.gameStatus === "playing" && game.currentRound && game.maxRounds && (
							<div style={{
								background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
								color: "white",
								padding: "6px 12px",
								borderRadius: "20px",
								fontSize: "12px",
								fontWeight: "500",
							}}>
								📊 Round {game.currentRound}/{game.maxRounds}
							</div>
						)}

						{/* Timer */}
						{secondsLeft !== null && game.gameStatus === "playing" && (
							<div style={{
								background: secondsLeft <= 30 ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" : "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
								color: "white",
								padding: "6px 12px",
								borderRadius: "20px",
								fontSize: "12px",
								fontWeight: "500",
							}}>
								⏰ {secondsLeft}s
							</div>
						)}
					</div>

					{/* Players */}
					<div style={{
						background: "#f8fafc",
						padding: "8px 12px",
						borderRadius: "8px",
						fontSize: "14px",
						color: "#374151",
						border: "1px solid #e5e7eb",
						marginBottom: "8px"
					}}>
						<strong>Players:</strong> {game.players ? game.players.map((player) => player.username).join(", ") : "Loading..."}{" "}
						{game.players && game.players.length < 2 && (
							<span style={{ color: "#ef4444" }}>(Need at least 2 players)</span>
						)}
					</div>

					{/* Round Summary - POKAZUJ PO ZAKOŃCZONEJ RUNDZIE */}
					{roundSummary && game.gameStatus === "betweenRounds" && (
						<div style={{
							marginBottom: "8px",
							padding: "12px",
							background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
							borderRadius: "8px",
							border: "1px solid #10b981",
						}}>
							<div style={{ fontWeight: "600", marginBottom: "6px", color: "#065f46" }}>
								🎯 Round {game.currentRound - 1} Summary:
							</div>
							<div style={{ fontSize: "14px", color: "#047857" }}>
								Word: <strong>{roundSummary.word}</strong> (Difficulty: {roundSummary.difficulty}/5)
							</div>
							<div style={{ fontSize: "12px", color: "#047857", marginTop: "4px" }}>
								{roundSummary.correctGuessers ? roundSummary.correctGuessers.length : 0} players guessed correctly
							</div>
						</div>
					)}

					{/* Scores - ZWIĘKSZ PRZESTRZEŃ */}
					{Object.keys(scores).length > 0 && (
						<div style={{ marginBottom: "8px" }}>
							<div style={{ fontWeight: "600", marginBottom: "6px", color: "#374151" }}>
								🏆 Scores:
							</div>
							<div style={{
								background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
								padding: "8px",
								borderRadius: "8px",
								maxHeight: "200px", // ZWIĘKSZONE z 80px
								overflowY: "auto",
								border: "1px solid #e5e7eb",
							}}>
								{getFormattedScores().map((player, index) => (
									<div
										key={player.id}
										style={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
											padding: "5px 8px", // ZWIĘKSZONE padding
											background: player.isLastScorer
												? "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)"
												: player.isCurrentDrawer
												? "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)"
												: "transparent",
											borderRadius: "6px",
											marginBottom: "3px", // ZWIĘKSZONE
											border: player.isLastScorer ? "1px solid #10b981" : "none",
										}}
									>
										<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
											<span style={{
												fontWeight: "700",
												minWidth: "24px",
												fontSize: "13px", // ZWIĘKSZONE
												color: index < 3 ? "#f59e0b" : "#6b7280",
											}}>
												#{index + 1}
											</span>
											<span style={{ fontSize: "15px", fontWeight: "500" }}> {/* ZWIĘKSZONE */}
												{player.username}
												{player.isCurrentDrawer && " 🎨"}
												{player.isLastScorer && " ✨"}
											</span>
										</div>
										<div style={{
											fontWeight: "700",
											color: player.isLastScorer ? "#10b981" : "#374151",
											fontSize: "15px", // ZWIĘKSZONE
										}}>
											{player.score}
											{player.isLastScorer && lastScorer && (
												<span style={{
													fontSize: "12px", // ZWIĘKSZONE
													color: "#6b7280",
													marginLeft: "4px",
												}}>
													(+{lastScorer.points})
												</span>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Queue Info */}
					{game.drawerChoice === "queue" && game.gameStatus === "playing" && (
						<div style={{
							fontSize: "12px",
							background: "#fef3c7",
							padding: "6px 8px",
							borderRadius: "6px",
							border: "1px solid #f59e0b",
						}}>
							<strong>🎨 Drawing Queue:</strong>
							{drawerQueue.length > 0 ? (
								<div style={{ marginLeft: 8, marginTop: 2 }}>
									{drawerQueue.map((queuedPlayer, index) => (
										<div key={queuedPlayer.socketId} style={{ color: "#92400e" }}>
											{index + 1}. {queuedPlayer.username}
											{queuedPlayer.socketId === currentSocketId && " (You)"}
										</div>
									))}
								</div>
							) : (
								<span style={{ color: "#92400e", marginLeft: 8 }}>No one in queue</span>
							)}
							<div style={{ color: "#92400e", marginTop: 2 }}>
								Rounds remaining: {getRoundsLeft()}
							</div>
						</div>
					)}
				</div>

				{/* Drawing Tools */}
				{isDrawer && game.gameStatus === "playing" && (
					<div style={{
						display: "flex",
						gap: "8px",
						marginBottom: "12px",
						flexWrap: "wrap",
						padding: "12px",
						background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
						borderRadius: "12px",
						border: "1px solid #e5e7eb",
						flex: "0 0 auto",
					}}>
						<button onClick={handlePenClick} disabled={!eraseMode || !isDrawer} style={{
							background: !eraseMode ? "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)" : "#e5e7eb",
							color: !eraseMode ? "white" : "#6b7280",
							border: "none",
							padding: "6px 12px",
							borderRadius: "6px",
							fontSize: "12px",
							fontWeight: "500",
							cursor: "pointer",
						}}>
							✏️ Pen
						</button>
						<button onClick={handleEraserClick} disabled={eraseMode || !isDrawer} style={{
							background: eraseMode ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" : "#e5e7eb",
							color: eraseMode ? "white" : "#6b7280",
							border: "none",
							padding: "6px 12px",
							borderRadius: "6px",
							fontSize: "12px",
							fontWeight: "500",
							cursor: "pointer",
						}}>
							🧹 Eraser
						</button>
						<label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: "500" }}>
							🎨 Color:
							<input
								type="color"
								value={strokeColor}
								onChange={handleStrokeColorChange}
								disabled={!isDrawer}
								style={{ width: "30px", height: "30px", borderRadius: "4px", border: "1px solid #d1d5db" }}
							/>
						</label>
						<label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: "500" }}>
							📏 Size:
							<input
								type="range"
								min="1"
								max="50"
								value={eraseMode ? eraserWidth : strokeWidth}
								onChange={eraseMode ? handleEraserWidthChange : handleStrokeWidthChange}
								disabled={!isDrawer}
								style={{ width: "60px" }}
							/>
						</label>
						<button onClick={handleUndoClick} disabled={!isDrawer} style={{
							background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
							color: "white",
							border: "none",
							padding: "6px 12px",
							borderRadius: "6px",
							fontSize: "12px",
							fontWeight: "500",
							cursor: "pointer",
						}}>
							↶ Undo
						</button>
						<button onClick={handleRedoClick} disabled={!isDrawer} style={{
							background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
							color: "white",
							border: "none",
							padding: "6px 12px",
							borderRadius: "6px",
							fontSize: "12px",
							fontWeight: "500",
							cursor: "pointer",
						}}>
							↷ Redo
						</button>
						<button onClick={handleClearClick} disabled={!isDrawer} style={{
							background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
							color: "white",
							border: "none",
							padding: "6px 12px",
							borderRadius: "6px",
							fontSize: "12px",
							fontWeight: "500",
							cursor: "pointer",
						}}>
							🗑️ Clear
						</button>
					</div>
				)}

				{/* Canvas - POPRAWIONE FLEXBOX */}
				<div style={{
					flex: 1,
					minHeight: 0,
					position: "relative",
					border: "3px solid #e5e7eb",
					borderRadius: "12px",
					overflow: "hidden",
					boxShadow: "inset 0 2px 8px rgba(0, 0, 0, 0.1)",
				}}>
					<ReactSketchCanvas
						ref={canvasRef}
						strokeWidth={eraseMode ? eraserWidth : strokeWidth}
						eraserWidth={eraserWidth}
						strokeColor={strokeColor}
						canvasColor={canvasColor}
						height="100%"
						width="100%"
						readOnly={effectiveReadOnly}
						onChange={handleCanvasChange}
						style={{ 
							border: "none", 
							width: "100%", 
							height: "100%",
							display: "block"
						}}
					/>
					{(!isDrawer || game.gameStatus !== "playing") && (
						<div style={{
							position: "absolute",
							inset: 0,
							zIndex: 10,
							cursor: "not-allowed",
						}} />
					)}
				</div>

				{/* Word Selection Modal - bez zmian */}
				{isDrawer && game.gameStatus === "choosing_word" && wordChoices.length > 0 && (
					<div style={{
						position: "fixed",
						top: "50%",
						left: "50%",
						transform: "translate(-50%, -50%)",
						background: "white",
						border: "2px solid #333",
						borderRadius: "10px",
						padding: "20px",
						boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
						zIndex: 1000,
						textAlign: "center",
						minWidth: "400px",
					}}>
						<h3 style={{ marginBottom: "16px" }}>Choose Your Word to Draw</h3>
						{wordChoiceTimeLeft !== null && (
							<div style={{
								marginBottom: "16px",
								fontSize: "14px",
								color: wordChoiceTimeLeft <= 5 ? "#f44336" : "#666",
							}}>
								Time to choose: <strong>{wordChoiceTimeLeft}</strong> seconds
							</div>
						)}
						<div style={{
							display: "flex",
							gap: "12px",
							justifyContent: "center",
							flexWrap: "wrap",
						}}>
							{wordChoices.map((wordChoice, index) => (
								<button
									key={index}
									onClick={() => handleWordSelection(wordChoice)}
									style={{
										padding: "12px 16px",
										border: `2px solid ${getDifficultyColor(wordChoice.difficulty)}`,
										borderRadius: "8px",
										background: "white",
										cursor: "pointer",
										minWidth: "120px",
										transition: "all 0.2s ease",
									}}
									onMouseOver={(e) => {
										e.target.style.background = getDifficultyColor(wordChoice.difficulty);
										e.target.style.color = "white";
									}}
									onMouseOut={(e) => {
										e.target.style.background = "white";
										e.target.style.color = "black";
									}}
								>
									<div style={{ fontWeight: "bold", fontSize: "16px" }}>
										{wordChoice.word}
									</div>
									<div style={{
										fontSize: "12px",
										color: getDifficultyColor(wordChoice.difficulty),
										fontWeight: "bold",
									}}>
										{getDifficultyLabel(wordChoice.difficulty)}
									</div>
								</button>
							))}
						</div>
						<div style={{
							marginTop: "12px",
							fontSize: "12px",
							color: "#666",
						}}>
							If you dont choose, the first word will be automatically selected.
						</div>
					</div>
				)}
			</div>

			{/* Right: Chat Area (1/3) - bez zmian */}
			<div style={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				background: "#ffffff",
				border: "2px solid #e5e7eb",
				borderRadius: "16px",
				padding: "16px",
				minWidth: 0,
				boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
			}}>
				<div style={{ 
					marginBottom: "12px", 
					fontWeight: "600", 
					fontSize: "18px", 
					color: "#374151",
					textAlign: "center",
					padding: "8px",
					background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
					borderRadius: "8px",
				}}>
					💬 Chat & Guesses
				</div>
				<div style={{ 
					flex: 1, 
					overflowY: "auto", 
					marginBottom: "12px",
					padding: "8px",
					background: "#f8fafc",
					borderRadius: "8px",
					border: "1px solid #e5e7eb",
				}}>
					{chatMessages.map((msg, idx) => (
						<div
							key={idx}
							style={{
								marginBottom: "6px",
								padding: "6px 8px",
								borderRadius: "8px",
								background:
									msg.user === "System"
										? msg.type === "keyword_event"
											? "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)"
											: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)"
										: msg.user === loggedInUser?.username
										? "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)"
										: "#ffffff",
								fontWeight: msg.user === "System" ? "600" : "normal",
								border: "1px solid #e5e7eb",
								fontSize: "14px",
							}}
						>
							<span style={{ fontWeight: "600" }}>
								{msg.user === loggedInUser?.username && msg.user !== "System"
									? "You"
									: msg.user}
								:
							</span>{" "}
							{msg.text}
						</div>
					))}
				</div>
				<form
					onSubmit={handleSendChatMessage}
					style={{ display: "flex", flexDirection: "column", gap: "8px" }}
				>
					<div style={{ display: "flex", gap: "8px" }}>
						<input
							type="text"
							value={chatInput}
							onChange={(e) => setChatInput(e.target.value)}
							placeholder={
								isDrawer
									? "You are drawing, can't guess!"
									: hasGuessedCorrectly
									? "You already guessed correctly!"
									: "Type your guess or chat..."
							}
							disabled={isDrawer || hasGuessedCorrectly}
							style={{
								flex: 1,
								padding: "10px",
								borderRadius: "8px",
								border: "2px solid #e5e7eb",
								fontSize: "14px",
								outline: "none",
							}}
						/>
						<button type="submit" disabled={isDrawer} style={{
							background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
							color: "white",
							border: "none",
							padding: "10px 16px",
							borderRadius: "8px",
							fontSize: "14px",
							fontWeight: "500",
							cursor: "pointer",
							boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
						}}>
							Send
						</button>
					</div>

					{/* Drawer Queue Button */}
					{game.drawerChoice === "queue" && game.gameStatus === "playing" && !isDrawer && getRoundsLeft() > 0 && (
						<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
							<button
								type="button"
								onClick={handleJoinDrawerQueue}
								style={{
									padding: "8px 16px",
									borderRadius: "8px",
									border: "2px solid #e5e7eb",
									background: isInQueue 
										? "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)" 
										: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
									color: isInQueue ? "#dc2626" : "#1d4ed8",
									fontSize: "14px",
									fontWeight: "500",
									cursor: "pointer",
								}}
								disabled={getRoundsLeft() === 0}
							>
								{isInQueue ? "🚪 Leave Drawing Queue" : "🎨 Join Drawing Queue"}
							</button>
							{queueMessage && (
								<div style={{
									fontSize: "12px",
									color: "#059669",
									textAlign: "center",
									padding: "4px",
									background: "#ecfdf5",
									borderRadius: "4px",
								}}>
									{queueMessage}
								</div>
							)}
							{getRoundsLeft() === 0 && (
								<div style={{
									fontSize: "12px",
									color: "#6b7280",
									textAlign: "center",
								}}>
									No more rounds left
								</div>
							)}
						</div>
					)}
				</form>
			</div>
			{gameEndData && (
				<GameEndPopup
					winner={gameEndData.winner}
					scores={gameEndData.scores}
					gameStats={gameEndData.gameStats}
					socket={socketRef.current}
					roomId={roomId}
				/>
			)}
		</div>
	);
}
