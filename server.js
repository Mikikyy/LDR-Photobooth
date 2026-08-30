const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e7
});

// ชี้มาที่ index.html ที่อยู่โฟลเดอร์นอกสุดโดยตรง
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);

    socket.on('update-config', (config) => {
      io.to(roomId).emit('config-updated', config);
    });

    socket.on('start-countdown', () => {
      io.to(roomId).emit('trigger-countdown');
    });

    socket.on('send-photos', (photos) => {
      socket.to(roomId).emit('receive-partner-photos', photos);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
