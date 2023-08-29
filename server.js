const app = require("express")();
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer, {
  cors: {
    origin: ["https://code-editor-delta.vercel.app", "http://localhost:5173"],
    
  },
});

// var io = require('socket.io')(httpServer,  { cors: { origin: '*' } });
// Store connected users and rooms
const roomToUsersMap = {};

// Function to broadcast user updates
function broadcastConnectedUsers(roomId) {
  io.to(roomId).emit("connectedUsersUpdated", roomToUsersMap[roomId]);
}

// Function to broadcast user join
function broadcastUserJoin(roomId, username) {
  io.to(roomId).emit('userJoined', `${username} joined the room`);
}

// Function to broadcast user leave
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
    // Broadcast the updated code to all clients in the room, excluding the sender
    socket.broadcast.to(roomId).emit("codeUpdated", value);
  });
});

httpServer.listen(5000, () => {
  console.log("Server is active...");
});
