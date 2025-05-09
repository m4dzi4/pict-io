const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // frontend origin
    methods: ["GET", "POST"]
  }
});

// --- Game State (simplified, in-memory) ---
const games = {}; // Store game states, e.g., games[gameId] = { players: [], currentPrompt: '', drawerId: '' }
const prompts = ["apple", "banana", "car", "house", "tree", "sun"]; // Example prompts

function getNextPrompt() {
  return prompts[Math.floor(Math.random() * prompts.length)];
}

function assignDrawer(gameId) {
  if (games[gameId] && games[gameId].players.length > 0) {
    // Simple rotation or random assignment
    const currentIndex = games[gameId].players.findIndex(p => p.id === games[gameId].drawerId);
    const nextIndex = (currentIndex + 1) % games[gameId].players.length;
    games[gameId].drawerId = games[gameId].players[nextIndex].id;
    return games[gameId].drawerId;
  }
  return null;
}

function startGameRound(gameId) {
  if (!games[gameId]) return;
  games[gameId].currentPrompt = getNextPrompt();
  games[gameId].drawerId = assignDrawer(gameId) || (games[gameId].players[0]?.id); // Assign first player if no current drawer

  io.to(gameId).emit('game_update', {
    currentPrompt: games[gameId].currentPrompt,
    drawerId: games[gameId].drawerId,
  });
  console.log(`Game ${gameId}: New round. Prompt: ${games[gameId].currentPrompt}, Drawer: ${games[gameId].drawerId}`);
}


io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on('join_game', ({ gameId, userId }) => {
    socket.join(gameId);
    if (!games[gameId]) {
      games[gameId] = { players: [], currentPrompt: '', drawerId: null, drawingPaths: [] };
    }
    if (!games[gameId].players.find(p => p.id === socket.id)) {
        games[gameId].players.push({ id: socket.id, score: 0 });
    }
    
    console.log(`User ${socket.id} joined game ${gameId}`);
    // Send current game state to the new player
    socket.emit('game_update', { 
        currentPrompt: games[gameId].currentPrompt, 
        drawerId: games[gameId].drawerId 
    });
    // If paths exist, send them
    if (games[gameId].drawingPaths && games[gameId].drawingPaths.length > 0) {
        socket.emit('drawing_data_broadcast', { paths: games[gameId].drawingPaths });
    }


    // If this is the first player or game needs to start/restart
    if (games[gameId].players.length === 1 || !games[gameId].currentPrompt) {
      startGameRound(gameId);
    }
    io.to(gameId).emit('new_message', { user: 'System', text: `${userId || socket.id} has joined the game.`, type: 'system' });
  });

  socket.on("submit_guess", (data) => { // data: { gameId, userId, text }
    const game = games[data.gameId];
    if (!game) return;

    const isCorrect = data.text.toLowerCase() === game.currentPrompt?.toLowerCase();
    
    // Broadcast the guess to the room
    io.to(data.gameId).emit('new_message', { 
        user: data.userId, 
        text: data.text, 
        type: isCorrect ? 'feedback' : 'guess' 
    });

    if (isCorrect) {
      io.to(data.gameId).emit('guess_correct_notification', { 
          guesserId: data.userId, 
          word: game.currentPrompt 
      });
      // Add points, start new round etc.
      console.log(`Game ${data.gameId}: ${data.userId} guessed correctly!`);
      startGameRound(data.gameId); // Start a new round
    }
  });

  socket.on('drawing_update', ({ gameId, paths }) => {
    if (games[gameId] && socket.id === games[gameId].drawerId) {
      games[gameId].drawingPaths = paths; // Store the latest paths
      socket.to(gameId).broadcast.emit('drawing_data_broadcast', { paths });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Handle player leaving a game
    for (const gameId in games) {
      const playerIndex = games[gameId].players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        games[gameId].players.splice(playerIndex, 1);
        io.to(gameId).emit('new_message', { user: 'System', text: `${socket.id} has left the game.`, type: 'system' });
        if (games[gameId].drawerId === socket.id) {
          // If the drawer leaves, start a new round or assign a new drawer
          console.log(`Drawer ${socket.id} left game ${gameId}. Starting new round.`);
          startGameRound(gameId);
        }
        if (games[gameId].players.length === 0) {
          console.log(`Game ${gameId} is empty, deleting.`);
          delete games[gameId];
        }
        break;
      }
    }
  });
});

// Example API route (keep if needed)
app.get("/api/ping", (req, res) => {
  res.send("pong");
});

const PORT = 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));