const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
  maxHttpBufferSize: 1e7,
  pingTimeout: 10000,
  pingInterval: 5000
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const roomConfigs = {};

io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    if (socket.roomId) socket.leave(socket.roomId);

    socket.join(roomId);
    socket.roomId = roomId;

    if (!roomConfigs[roomId]) {
      roomConfigs[roomId] = { slots: 3, theme: 'theme-pastel', currentStep: 'step1' };
    }

    const sendRoomStatus = () => {
      const room = io.sockets.adapter.rooms.get(roomId);
      const userCount = room ? room.size : 0;
      
      io.to(roomId).emit('room-status', { 
        userCount: userCount, 
        config: roomConfigs[roomId] 
      });
    };

    sendRoomStatus();

    // ส่งภาพกล้องสด Real-Time ระหว่างกัน
    socket.on('stream-frame', (frameData) => {
      socket.to(roomId).emit('receive-partner-stream', frameData);
    });

    socket.on('change-step', (stepId) => {
      if (roomConfigs[roomId]) {
        roomConfigs[roomId].currentStep = stepId;
      }
      io.to(roomId).emit('navigate-to-step', stepId);
    });

    socket.on('update-config', (config) => {
      if (roomConfigs[roomId]) {
        roomConfigs[roomId].slots = config.slots;
        roomConfigs[roomId].theme = config.theme;
      }
      io.to(roomId).emit('config-updated', config);
    });

    socket.on('start-countdown', () => io.to(roomId).emit('trigger-countdown'));
    socket.on('send-photos', (photos) => socket.to(roomId).emit('receive-partner-photos', photos));
    
    // ตกแต่ง
    socket.on('add-sticker', (data) => io.to(roomId).emit('sticker-added', data));
    socket.on('update-sticker-pos', (data) => io.to(roomId).emit('sticker-moved', data));
    socket.on('update-frame-text', (text) => io.to(roomId).emit('frame-text-updated', text));
    socket.on('update-font-style', (fontClass) => io.to(roomId).emit('font-style-updated', fontClass));
    socket.on('update-text-pos', (pos) => io.to(roomId).emit('text-pos-moved', pos));

    socket.on('disconnect', () => sendRoomStatus());
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
