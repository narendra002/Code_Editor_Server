const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors()); // Enable CORS for your Express app
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'https://code-editor-delta.vercel.app/');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer, {
  cors: {
    origin: ["https://code-editor-delta.vercel.app/", "http://localhost:5173"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization", "Access-Control-Allow-Origin"],
    credentials: true,
  }
});


const roomToUsersMap = {}; // Store connected users and rooms

function broadcastConnectedUsers(roomId) {
  io.to(roomId).emit("connectedUsersUpdated", roomToUsersMap[roomId]);
}

function broadcastUserJoin(roomId, username) {
  io.to(roomId).emit('userJoined', `${username} joined the room`);
}

function broadcastUserLeave(roomId, username) {
  io.to(roomId).emit('userLeave', `${username} left the room`);
}

let isSocketConnected = false; // Flag to track if the message has been logged

io.on("connection", (socket) => {
  if (!isSocketConnected) {
    console.log("Socket is Connected");
    isSocketConnected = true;
  }

  socket.on('joinRoom', (roomId, username, callback) => {
    const response = {
      success: true,
    };
    callback(response);

    socket.join(roomId);

    if (!roomToUsersMap[roomId]) {
      roomToUsersMap[roomId] = [];
    }

    const user = { roomId, username, id: socket.id };
    roomToUsersMap[roomId].push(user);

    broadcastConnectedUsers(roomId);
    broadcastUserJoin(roomId, username);
  });

  socket.on('leaveRoom', (roomId, username) => {
    const usersInRoom = roomToUsersMap[roomId];
    if (usersInRoom) {
      const userIndex = usersInRoom.findIndex(user => user.id === socket.id);
      if (userIndex !== -1) {
        usersInRoom.splice(userIndex, 1);
      }
      broadcastConnectedUsers(roomId);
      broadcastUserLeave(roomId, username);
      socket.leave(roomId);
    }
  });

  socket.on("disconnect", () => {
    for (const roomId in roomToUsersMap) {
      const usersInRoom = roomToUsersMap[roomId];
      const userIndex = usersInRoom.findIndex(user => user.id === socket.id);
      if (userIndex !== -1 && usersInRoom[userIndex]) {
        const { username } = usersInRoom[userIndex];
        usersInRoom.splice(userIndex, 1);
        io.to(roomId).emit("connectedUsersUpdated", roomToUsersMap[roomId]);
        broadcastUserLeave(roomId, username);
      }
    }
  });

  socket.on("updateCode", (roomId, value) => {
    socket.broadcast.to(roomId).emit("codeUpdated", value);
  });
});

httpServer.listen(5000, () => {
  console.log("Server is active...");
});
