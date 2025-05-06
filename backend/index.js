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
    origin: "http://localhost:3000", // your frontend origin
    methods: ["GET", "POST"]
  }
});

// Example Socket.IO logic
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("send_guess", (data) => {
    io.emit("receive_guess", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Example API route
app.get("/api/ping", (req, res) => {
  res.send("pong");
});

const PORT = 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));