const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const roomConfigs = {};

io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    // ออกจากห้องเดิมก่อนถ้ามี
    if (socket.roomId) {
      socket.leave(socket.roomId);
    }

    socket.join(roomId);
    socket.roomId = roomId;

    if (!roomConfigs[roomId]) {
      roomConfigs[roomId] = { slots: 3, theme: 'theme-pastel' };
    }

    // ฟังก์ชันส่งจำนวนคนจริงในห้อง
    const sendRoomStatus = () => {
      const room = io.sockets.adapter.rooms.get(roomId);
      const userCount = room ? room.size : 0;
      io.to(roomId).emit('room-status', { 
        userCount: userCount, 
        config: roomConfigs[roomId] 
      });
    };

    sendRoomStatus();

    socket.on('change-step', (stepId) => {
      io.to(roomId).emit('navigate-to-step', stepId);
    });

    socket.on('update-config', (config) => {
      roomConfigs[roomId] = config;
      io.to(roomId).emit('config-updated', config);
    });

    socket.on('start-countdown', () => {
      io.to(roomId).emit('trigger-countdown');
    });

    socket.on('send-photos', (photos) => {
      socket.to(roomId).emit('receive-partner-photos', photos);
    });

    socket.on('add-sticker', (stickerData) => {
      io.to(roomId).emit('sticker-added', stickerData);
    });

    socket.on('update-sticker-pos', (data) => {
      io.to(roomId).emit('sticker-moved', data);
    });

    socket.on('update-frame-text', (text) => {
      io.to(roomId).emit('frame-text-updated', text);
    });

    socket.on('disconnect', () => {
      sendRoomStatus();
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
