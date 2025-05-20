const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { PrismaClient } = require('./generated/prisma');
const bcrypt = require('bcryptjs'); // Import bcryptjs
const jwt = require('jsonwebtoken'); // Import jsonwebtoken

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
  const game = games[roomId];
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
  }
  const randomIndex = Math.floor(Math.random() * game.players.length);
  return game.players[randomIndex].id;
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


// Socket.IO connection
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on('join_room', async ({ roomId, token, accessCode: providedAccessCode }, callback) => {
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
        if (!game) {
          return callback({ success: false, message: 'Game session not found or not active.' });
        }
        // If room is private, check access code (even if validated via HTTP, double check here)
        if (game.accessCode && game.accessCode !== providedAccessCode) {
            return callback({ success: false, message: 'Invalid access code for private room.' });
        }
        
        let userIdExists = isAuthenticated ? game.players.find(p => p.dbUserId === joiningUserId) : game.players.find(p => p.id === socket.id);
        let isOwner = isAuthenticated && joiningUserId === game.ownerId;

        if (userIdExists) {
            const player = userIdExists
            socket.join(roomId);
            console.log(`User ${player.username} (Socket: ${socket.id}) re-confirmed in room ${roomId}.`);
            callback({ success: true, game: games[roomId] });
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

        callback({ success: true, game: games[roomId]});
        
        socket.broadcast.to(roomId).emit('new_chat_message', {
          user: 'System',
          text: `${joiningUsername} has joined the room.`
        });
        socket.broadcast.to(roomId).emit('update_game', { players: game.players, drawerId: game.drawerId, drawingPaths: game.drawingPaths});

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
        correct_guess(senderId);
      } else {
        game.round_history[game.currentRound].all_guesses[senderId] = text;
      }
    }
    
    io.to(roomId).emit('new_chat_message', messageData);
  });

  // If the guess is correct, update the game state and notify players
  function correct_guess(senderId) {
      const game = games[roomId];
      
      // Send a special message only visible to the guesser that they were correct
      socket.emit('new_chat_message', { 
        user: 'System', 
        text: `Correct! You guessed the word: ${game.keyword}!`,
        type: 'correct_guess'
      });
      // Update the scores
      game.scores[senderId] = (game.scores[senderId]) + 1;  
  }

  socket.on('new_round', ({ roomId }) => {
      const game = games[roomId];
      game.drawingPaths = [];
      game.currentRound += 1;
      game.round_history[game.currentRound] = {drawerId: game.drawerId, keyword: game.keyword, correct_guesses: [], all_guesses: {}};
      game.drawerId = getDrawer(roomId);
      game.keyword = getRandomKeyword();
      // Notify all players about the new round
  });

  socket.on('end_round', ({ roomId }) => {
  });

  socket.on('end_game', ({ roomId }) => {
  });

  socket.on('start_game', ({ roomId }) => {
      console.log(`Received start_game request from ${socket.id} for room ${roomId}`);
      const game = games[roomId];
      if (!game) {
          console.warn(`Start game requested for non-existent room ${roomId}`);
          return;
      }
      // Check if we have enough players
      if (game.players.length < 2) {
          console.warn(`Not enough players to start game in room ${roomId}`);
          return;
      }

      game.gameStatus = 'playing';
      // Initialize the first round
      socket.emit('new_round', { roomId });

      // Notify everyone that the game is starting
      io.to(roomId).emit('game_started');

      // Then, send the keyword only to the drawer (separating these events prevents duplication)
      setTimeout(() => {
          io.to(game.drawerId).emit('new_keyword_for_drawer', { keyword: game.keyword });
      }, 500); // Small delay to ensure proper ordering of events
  });

  socket.on("disconnect", () => {
  console.log("Socket disconnected:", socket.id);
  
  for (const roomId in games) {
    const game = games[roomId];
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    
    if (playerIndex !== -1) {
      const removedPlayer = game.players.splice(playerIndex, 1)[0];
      console.log(`User ${removedPlayer.username} (Socket: ${socket.id}) removed from room ${roomId}`);
      
      io.to(roomId).emit('new_chat_message', { 
        user: 'System', 
        text: `${removedPlayer.username} has disconnected.` 
      });
      
      io.to(roomId).emit('game_update', { drawerId: game.drawerId, drawingPaths: game.drawingPaths, players: game.players.map(p=>p.username) });

      if (game.players.length === 0) {
        console.log(`Room ${roomId} is empty. Cleaning up from database and memory.`);
        
        // Mark room as inactive in database
        markRoomInactive(roomId)
          .then(() => console.log(`Room ${roomId} marked as inactive in database`))
          .catch(err => console.error(`Error marking room ${roomId} as inactive:`, err));
        
        // Remove from memory
        delete games[roomId];
      } else if (removedPlayer.id === game.drawerId) { 
          // Drawer disconnected, assign a new drawer
          game.players[0].isDrawer = true;
          game.drawerId = game.players[0].id;
          game.keyword = getRandomKeyword();
          game.drawingPaths = [];
          
          io.to(roomId).emit('game_update', { 
            drawerId: game.drawerId,
            drawingPaths: [], 
            players: game.players.map(p=>p.username)
          });
          io.to(game.drawerId).emit('new_keyword_for_drawer', { keyword: game.keyword });
          
          io.to(roomId).emit('new_chat_message', { 
            user: 'System', 
            text: `${game.players[0].username} is now the drawer. A new keyword has been set.` 
          });
        }
        break; 
      }
    }
  });
});

app.get("/api/ping", (req, res) => {
  res.send("pong");
});

const PORT = 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));