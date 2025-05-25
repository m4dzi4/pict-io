const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { PrismaClient } = require('./generated/prisma');
const bcrypt = require('bcryptjs'); // Import bcryptjs
const jwt = require('jsonwebtoken'); // Import jsonwebtoken
const { realpathSync } = require('fs');
const { send } = require('process');

const app = express();
app.use(cors());
app.use(express.json()); 

const prisma = new PrismaClient();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // frontend origin
    methods: ["GET", "POST"]
  }
});

// TODO : Fix the logic where during the downtime between the rounds, the previous drawer can draw still.
// TODO : Fix the the logic where if the person guessing is not a guest, the guess is not sent properly.
// TODO : Add the logic for game end and the statistics display. Also send the statistics to the database.
// TODO : Add the logic for the game round history to be saved in the database.
// TODO : Change the keywords to be stored in the database and not hardcoded.
// TODO : Add logic for only one person being in the room - check if only one person, notify them, give them some time to leave, or others to join and then delete the room
// TODO : Fix logic, where if the game ends, the game is deleted from the database and memory, as well as remove all sockets from the room.
// TODO : Change logic to use only the database for the rooms and not the memory ???
// TODO : Fix private room logic - fix the acccess code logic.
// TODO : Add leaderboard logic - add the leaderboard to the database and show it in the game.
// TODO : Fix room creation logic - check all options are working correctly.
// TODO : Add logged in user statistics display + retrieval from the database.
// TODO : Add a leave room / game button - remove the user from the room / game and update the database.
// TODO : Add a destroy room button - remove the room from the database and memory and removes all sockets from the room.
// TODO : Add a join from a list of rooms - show the list of rooms and allow the user to join a room.
// TODO : Add SSO
// TODO : Add a way to change the username / password, etc. - add a way to change this in the database.
// TODO : Add frontend beuty
// TODO : Dockerize the app

const JWT_SECRET = process.env.JWT_SECRET
// TODO: should be handled as a call to the database
const KEYWORDS_LIST = ["apple", "banana", "car", "house", "tree", "sun", "moon", "star", "book", "clock", "river", "mountain", "bridge", "flower", "fish"];
let games = {}; // roomID : game object

async function generateRoomId() {
  let newRoomId;
  let roomExists = true;
  do {
    newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    // Check if it exists in memory OR in the database
    const dbRoom = await prisma.room.findUnique({ where: { roomId: newRoomId } }).catch(() => null);
    roomExists = !!games[newRoomId] || !!dbRoom;
  } while (roomExists);
  return newRoomId;
}

function getRandomKeyword() {
  // TODO : Add a check for previous rounds not having the same keyword
  return KEYWORDS_LIST[Math.floor(Math.random() * KEYWORDS_LIST.length)];
}

function getDrawer(roomId) {
  // TODO : What if the player is no longer in the game - check for validity.
  const game = games[roomId];
  if (game.currentRound === 1) { // First round, drawer is the owner
    const ownerPlayer = game.players.find(p => p.dbUserId === game.ownerId);
    return ownerPlayer ? ownerPlayer.id : null;
  } else {
    if (game.drawerChoice === 'queue') {
      // The player that is at the start of the queue is selected as the drawer
      if (game.drawerQueue.length === 0) return;
      const firstPlayer = game.drawerQueue[0];
      game.drawerQueue.shift(); // Remove the first player from the queue
      return firstPlayer.id;
    } else if (game.drawerChoice === 'winner') {
      // The player that guessed first in the last round becomes the drawer
      // round_history: {}, // { roundNumber: { drawerId, keyword, correct_guesses in order [player1, player2, player3], all_guesses {} } }
      const lastRound = game.round_history[game.currentRound - 1];
      if (!lastRound || !lastRound.correct_guesses || lastRound.correct_guesses.length === 0) return;
      const firstGuesserId = lastRound.correct_guesses[0];
      return firstGuesserId;
    } else { // else random
      const randomIndex = Math.floor(Math.random() * game.players.length);
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
        status: 'ended',
        updatedAt: new Date()
      }
    });
    return true;
  } catch (error) {
    console.error(`Error marking room ${roomId} as inactive:`, error);
    return false;
  }
}

// Helper function to remove a room from the database
async function deleteRoomFromDatabase(roomId) {
  try {
    // Delete the room record from the database
    await prisma.room.delete({
      where: { roomId }
    });
    console.log(`Room ${roomId} successfully deleted from database`);
    return true;
  } catch (error) {
    console.error(`Error deleting room ${roomId} from database:`, error);
    return false;
  }
}

// Registration
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  } else if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
  }
  try {
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Username already taken.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: { username, hashedPassword },
    });
    res.status(201).json({ success: true, message: 'Registration successful! Please log in.', user: { id: newUser.id, username: newUser.username } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
    const tokenPayload = { userId: user.id, username: user.username };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });
    res.json({ success: true, message: 'Login successful!', token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) return res.sendStatus(401); // if there isn't any token

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error("JWT verification error:", err.message);
      return res.status(403).json({ success: false, message: "Token is not valid or expired."}); // if token is not valid
    }
    req.user = user; // Add decoded user payload to request
    next(); // pass the execution off to whatever request the client intended
  });
};

// Create Room
app.post('/api/rooms/create', authenticateToken, async (req, res) => {
  const { settings } = req.body;
  const creatorUsername = req.user.username; // From JWT
  // TODO : Add connection between users and rooms in DB
  const creatorDbId = req.user.userId;     // From JWT

  try {
    const roomId = await generateRoomId();
    
    const dbRoom = await prisma.room.create({
      data: {
        roomId: roomId,
        maxPlayers: settings?.maxPlayers || 8,
        accessCode: (settings?.isPrivate && settings?.accessCode) ? settings.accessCode : null,
        ownerId: creatorDbId, // to track room ownership
        gameMode: settings?.gameMode || 'rounds',
        maxRounds: settings?.maxRounds || 5,
        pointsToWin: settings?.pointsToWin || 3,
        roundDuration: settings?.roundDuration || 60,
        drawerChoice: settings?.drawerChoice || 'random',
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
      scores: {},  // Player scores: { playerId: score }
      currentRound: 0,
      gameStatus: 'waiting'
    };
    console.log(`Room ${dbRoom.roomId} created in memory by ${creatorUsername}.`);
    res.status(201).json({ success: true, roomId: dbRoom.roomId, isOwner: true });
  } catch (error) {
    console.error("Error creating room via API:", error);
    res.status(500).json({ success: false, message: 'Failed to create room.' });
  }
});

// Validate Room Code (for joining)
app.get('/api/rooms/validate/:roomId', async (req, res) => {
  const { roomId } = req.params;
  try {
    const dbRoom = await prisma.room.findUnique({ where: { roomId } });
    if (!dbRoom) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }
    // Check if room is in memory (i.e., active)
    const game = games[roomId];
    if (!game) {
        // If not in memory, but in DB, it might be an old room or needs re-initialization
        // For simplicity, let's assume if not in `games`, it's not actively joinable for now
        // Or, you could re-initialize it here if desired.
        console.warn(`Room ${roomId} found in DB but not in active games memory.`);
        // Re-initialize if needed, or treat as not joinable
        return res.status(404).json({ success: false, message: 'Room is not currently active.' });
    }

    if (game && game.players.length >= game.maxPlayers) {
        return res.status(403).json({ success: false, message: 'Room is full.' });
    }

    res.json({ success: true, roomId: dbRoom.roomId, isPrivate: !!dbRoom.accessCode });
  } catch (error) {
    console.error("Error validating room:", error);
    res.status(500).json({ success: false, message: 'Failed to validate room.' });
  }
});

function getPublicGameState(game) {
    return {
        roomId: game.roomId,
        ownerId: game.ownerId,
        ownerUsername: game.ownerUsername,
        maxPlayers: game.maxPlayers,
        accessCode: game.accessCode,
        gameMode: game.gameMode,
        maxRounds: game.maxRounds,
        pointsToWin: game.pointsToWin,
        roundDuration: game.roundDuration,
        drawerChoice: game.drawerChoice,
        drawerId: game.drawerId,
        keyword: null, // never send the keyword to all clients!
        drawingPaths: game.drawingPaths,
        players: game.players.map(p => ({
            id: p.id,
            username: p.username,
            dbUserId: p.dbUserId
        })),
        scores: game.scores,
        currentRound: game.currentRound,
        gameStatus: game.gameStatus
    };
}

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on('join_room', async ({ roomId, token, accessCode: providedAccessCode }, callback) => {
    socket.roomId = roomId;
    let joiningUsername = `Guest-${socket.id.substring(0,4)}`;
    let joiningUserId = null;
    let isAuthenticated = false;

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            joiningUsername = decoded.username;
            joiningUserId = decoded.userId;
            isAuthenticated = true;
        } catch (e) {
            console.warn(`Join room ${roomId} with invalid/expired token by ${socket.id}, proceeding as guest.`);
        }
    }

    try {
        const game = games[roomId];
        const publicGameState = getPublicGameState(game);
        if (!game) {
          return callback({ success: false, message: 'Game session not found or not active.' });
        }
        // If room is private, check access code (even if validated via HTTP, double check here)
        if (game.accessCode && game.accessCode !== providedAccessCode) {
            return callback({ success: false, message: 'Invalid access code for private room.' });
        }

        if (game.gameStatus === 'playing') {
          publicGameState.currentRound = game.currentRound;
          publicGameState.maxRounds = game.maxRounds;
          publicGameState.drawerId = game.drawerId;
          publicGameState.drawingPaths = game.drawingPaths;
          publicGameState.roundEndTime = game.roundEndTime;
          publicGameState.gameStatus = game.gameStatus;
          // Do NOT send the keyword!
        }
        
        let userIdExists = isAuthenticated ? game.players.find(p => p.dbUserId === joiningUserId) : game.players.find(p => p.id === socket.id);

        if (userIdExists) {
            const player = userIdExists
            socket.join(roomId);
            console.log(`User ${player.username} (Socket: ${socket.id}) re-confirmed in room ${roomId}.`);
            callback({ success: true, game: publicGameState });
            return;
        }

        if (game.players.length >= game.maxPlayers ) {
            return callback({ success: false, message: 'Room is full.' });
        }

        const newPlayer = { 
            id: socket.id, 
            username: joiningUsername,
            dbUserId: joiningUserId
        };
        game.players.push(newPlayer);
        game.scores[joiningUserId] = 0; // Initialize score for the new player
        socket.join(roomId);
        console.log(`User ${socket.id} (username: ${joiningUsername}) joined room ${roomId}.`);

        callback({ success: true, game: publicGameState});
        
        socket.broadcast.to(roomId).emit('update_game', { players: game.players, drawerId: game.drawerId, drawingPaths: game.drawingPaths});
        io.to(roomId).emit('new_chat_message', { 
          user: 'System', 
          text: `${newPlayer.username} has connected.` 
        });

    } catch (error) {
        console.error(`Error in socket join_room for room ${roomId}:`, error);
        callback({ success: false, message: 'Failed to join room via socket.' });
    }
  });
  
  socket.on('drawing_update', ({ roomId, paths }) => {
    const game = games[roomId];
    console.log(`Backend: Received drawing_update from ${socket.id} for room ${roomId}. Paths count: ${paths?.length}`); // Log receipt
    if (game && game.drawerId === socket.id) {
        // Make sure we're storing the exact paths array (not a reference that might be mutated)
        game.drawingPaths = Array.isArray(paths) ? [...paths] : []; // Clone the array or use empty array as fallback
        console.log(`Backend: Broadcasting drawing_data_broadcast to room ${roomId}. Paths count: ${paths?.length}`); // Log broadcast
        socket.broadcast.to(roomId).emit('drawing_data_broadcast', { paths });
    }
  });

  socket.on('send_chat_message', ({ roomId, text, token }) => {
    const game = games[roomId];
    let senderUsername = `Guest-${socket.id.substring(0,4)}`;
    let senderId = socket.id; // Default to socket ID for guests
    let isAuthenticated = false;

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            senderUsername = decoded.username;
            senderId = decoded.userId; // Use user ID from token if authenticated
            isAuthenticated = true;
        } catch (e) { /* guest */ }
    }
    if (!isAuthenticated) { // Fallback for guests already in game.players
        const playerInGame = game.players.find(p => p.id === socket.id);
        senderUsername = playerInGame.username;
        senderId = playerInGame.id; // Retrieve the player's id
    }
    
    const messageData = { user: senderUsername, text, timestamp: new Date() };

    if (game.gameStatus === 'playing') {
      if (game.keyword && text.toLowerCase().trim() === game.keyword.toLowerCase().trim()) {
        // Correct guess logic
        game.round_history[game.currentRound].correct_guesses.push(senderId);
        game.round_history[game.currentRound].all_guesses[senderId] = text;
        correct_guess(roomId, senderId);
      } else {
        game.round_history[game.currentRound].all_guesses[senderId] = text;
        io.to(roomId).emit('new_chat_message', messageData);
      }
    } else {
      io.to(roomId).emit('new_chat_message', messageData);
    }
  });

  function endRound(roomId, reason = "timer", senderId) {
    const game = games[roomId];
    if (!game) return;

    // Clear the round timer if it exists
    if (game.roundTimer) {
        clearTimeout(game.roundTimer);
        game.roundTimer = null;
    }

    io.to(roomId).emit('new_chat_message', { 
          user: 'System', 
          text: `Round ${game.currentRound} ended! Reason : ${reason}. The word was "${game.keyword}". New round starting soon...` 
    });
    
    io.to(roomId).emit('end_round', {
      gameStatus: 'betweenRounds'
    });

    // Check if game should end
    if (game.gameMode === 'rounds' && game.currentRound >= (game.maxRounds)) {
        endGame(roomId, currentRound);
    } else {
      // Start next round after a short delay (e.g., 3 seconds)
        setTimeout(() => startNewRound(roomId), 3000);
    }
  }

  // If the guess is correct, update the game state and notify players
  function correct_guess(roomId, senderId) {
      const game = games[roomId];
      const guesser = game.players.find(p => p.id === senderId);
      // Update the scores
      game.scores[senderId] = (game.scores[senderId]) + 1;  

      // 1. Special message only to the guesser
      io.to(senderId).emit('new_chat_message', { 
          user: 'System', 
          text: `Correct! You guessed the word: ${game.keyword}!`,
          type: 'correct_guess'
      });

      // 2. Notify all others (including drawer)
      socket.broadcast.to(roomId).emit('new_chat_message', { 
          user: 'System', 
          text: `${guesser ? guesser.username : 'Someone'} has guessed the word!`,
          type: 'other_correct'
      });

      // 3. Update guessed to disable chat for the guesser
      io.to(senderId).emit('update_guessed');

      // 4, Check if that means end of the game
      if (game.gameMode === 'points' && game.scores[senderId] >= (game.pointsToWin)) {
          endGame(roomId, senderId);
      }

      // 4. Check if all guessers have guessed correctly
      const allGuessers = game.players.filter(p => p.id !== game.drawerId);
      const correctGuessers = game.round_history[game.currentRound].correct_guesses;
      console.log(`All guessers: ${allGuessers.map(p => p.username).join(', ')}`);
      console.log(`Correct guessers: ${correctGuessers.map(p => p.username).join(', ')}`);
      console.log(`drawerId: ${game.drawerId}`);
      if (allGuessers.length > 0 && allGuessers.every(p => correctGuessers.includes(p.id))) {
          endRound(roomId, "all_guessed");
      }
  }

  function startNewRound(roomId) {
    const game = games[roomId];
    game.drawingPaths = [];
    game.currentRound += 1;
    game.drawerId = getDrawer(roomId);
    game.keyword = getRandomKeyword();
    console.log(`Starting new round ${game.currentRound} in room ${roomId}. Drawer: ${game.drawerId}, Keyword: ${game.keyword}`);
    game.round_history[game.currentRound] = {drawerId: game.drawerId, keyword: game.keyword, correct_guesses: [], all_guesses: {}};
    // Set round end time
    const roundDurationMs = (game.roundDuration) * 1000;
    game.roundEndTime = Date.now() + roundDurationMs;

    if (game.roundTimer) clearTimeout(game.roundTimer);
    game.roundTimer = setTimeout(() => endRound(roomId), roundDurationMs);

    // Emit new_round with roundEndTime
    io.to(roomId).emit('new_round', {
        drawingPaths: [],
        currentRound: game.currentRound,
        maxRounds: game.maxRounds,
        drawerId: game.drawerId,
        currentRound: game.currentRound,
        roundEndTime: game.roundEndTime, // <--- Only sent here!
        gameStatus: 'playing'
    });

    io.to(game.drawerId).emit('new_keyword', { keyword: game.keyword });
}

  socket.on('end_game', ({ roomId }) => {
  });

  socket.on('start_game', ({ roomId }, callback) => {
      const game = games[roomId];
      game.gameStatus = 'playing';
      game.currentRound = 0;
      startNewRound(roomId);
      // Notify everyone that the game is starting
      io.to(roomId).emit('game_started');
      callback({ gameStatus: 'playing'})
  });

async function disconnectRoomSockets(roomId) {
    const sockets = await io.in(roomId).fetchSockets();
    sockets.forEach(socket => {
        console.log(`Disconnecting socket ${socket.id} from room ${roomId}`);
        socket.disconnect(true);
    });
}

socket.on("disconnect", async () => {
    console.log("Socket disconnected:", socket.id);
    roomId = socket.roomId;
    const game = games[roomId];
    if (!game) {
        console.warn(`No game found for room ${roomId}.`);
        return;
    }
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    const removedPlayer = game.players.splice(playerIndex, 1)[0];
    io.to(roomId).emit('new_chat_message', { 
        user: 'System', 
        text: `${removedPlayer.username} has disconnected.` 
    });
    io.to(roomId).emit('update_game', { players: game.players, drawerId: game.drawerId, drawingPaths: game.drawingPaths });
    if (game.players.length === 0) {
      console.log(`Room ${roomId} is empty. Cleaning up from database and memory.`);
      
      // Mark room as inactive in database
      markRoomInactive(roomId)
        .then(() => console.log(`Room ${roomId} marked as inactive in database`))
        .catch(err => console.error(`Error marking room ${roomId} as inactive:`, err));
      // TODO: Add handler if the room is rejoined - then markRoomAsActive again.
      await disconnectRoomSockets(roomId);
      // TODO : Remove from memory
      // delete games[roomId];
    } else if (removedPlayer.id === game.drawerId) { 
        // TODO : Fix new drawer logic.
    }
  });
});

app.get("/api/ping", (req, res) => {
  res.send("pong");
});

app.post('/admin/disconnect-all', (req, res) => {
    io.sockets.sockets.forEach((socket) => {
        console.log(`Socket disconnected ${socket.id}`);
        socket.disconnect(true);
    });
    res.send('All sockets disconnected.');
});

const PORT = 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));