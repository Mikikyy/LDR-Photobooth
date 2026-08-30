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

  // ฟังก์ชันกระจายสถานะห้องให้ทุกคนในห้องรับรู้พร้อมกัน
  const sendRoomStatus = (roomId) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    const userCount = room ? room.size : 0;

    // อัปเดตจำนวนคนให้ทุกคนในห้อง
    io.to(roomId).emit('room-status', { 
      userCount: userCount, 
      config: roomConfigs[roomId] 
    });

    // 🚀 ถ้าคนครบ 2 คนแล้ว และยังอยู่ที่ step1 ให้สั่งพาเด้งไป step2 พร้อมกันอัตโนมัติ
    if (userCount >= 2 && roomConfigs[roomId] && roomConfigs[roomId].currentStep === 'step1') {
      roomConfigs[roomId].currentStep = 'step2';
      io.to(roomId).emit('navigate-to-step', 'step2');
    }
  };

  socket.on('join-room', (roomId) => {
    if (socket.roomId && socket.roomId !== roomId) {
      socket.leave(socket.roomId);
    }

    socket.join(roomId);
    socket.roomId = roomId;

    if (!roomConfigs[roomId]) {
      roomConfigs[roomId] = { slots: 3, theme: 'theme-pastel', currentStep: 'step1' };
    }

    sendRoomStatus(roomId);
  });

  // ส่งสตรีมภาพกล้องให้แฟนแบบ Real-time
  socket.on('stream-frame', (frameData) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('receive-partner-stream', frameData);
    }
  });

  socket.on('change-step', (stepId) => {
    if (socket.roomId && roomConfigs[socket.roomId]) {
      roomConfigs[socket.roomId].currentStep = stepId;
      io.to(socket.roomId).emit('navigate-to-step', stepId);
    }
  });

  socket.on('update-config', (config) => {
    if (socket.roomId && roomConfigs[socket.roomId]) {
      roomConfigs[socket.roomId].slots = config.slots;
      roomConfigs[socket.roomId].theme = config.theme;
      io.to(socket.roomId).emit('config-updated', config);
    }
  });

  socket.on('start-countdown', () => {
    if (socket.roomId) io.to(socket.roomId).emit('trigger-countdown');
  });

  socket.on('send-photos', (photos) => {
    if (socket.roomId) socket.to(socket.roomId).emit('receive-partner-photos', photos);
  });

  socket.on('add-sticker', (data) => {
    if (socket.roomId) io.to(socket.roomId).emit('sticker-added', data);
  });

  socket.on('update-sticker-pos', (data) => {
    if (socket.roomId) io.to(socket.roomId).emit('sticker-moved', data);
  });

  socket.on('update-frame-text', (text) => {
    if (socket.roomId) io.to(socket.roomId).emit('frame-text-updated', text);
  });

  socket.on('disconnect', () => {
    if (socket.roomId) {
      const roomToUpdate = socket.roomId;
      setTimeout(() => sendRoomStatus(roomToUpdate), 500);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
