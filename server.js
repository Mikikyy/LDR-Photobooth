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

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const roomConfigs = {};

io.on('connection', (socket) => {
  
  // ฟังก์ชันส่วนกลางสำหรับอัปเดตจำนวนคนในห้อง
  const broadcastRoomStatus = (roomId) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    const userCount = room ? room.size : 0;
    io.to(roomId).emit('room-status', { 
      userCount: userCount, 
      config: roomConfigs[roomId] 
    });
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

    // บังคับส่งสถานะให้ทุกคนในห้องทันทีที่มีคนเข้า
    broadcastRoomStatus(roomId);
  });

  // ถอด Disconnect ออกมาข้างนอก เพื่อไม่ให้ทำงานซ้ำซ้อน
  socket.on('disconnect', () => {
    if (socket.roomId) {
      broadcastRoomStatus(socket.roomId);
    }
  });

  // Events อื่นๆ อ้างอิงจาก socket.roomId โดยตรง ป้องกันการส่งผิดห้อง
  socket.on('stream-frame', (frameData) => socket.to(socket.roomId).emit('receive-partner-stream', frameData));
  
  socket.on('change-step', (stepId) => {
    if (roomConfigs[socket.roomId]) roomConfigs[socket.roomId].currentStep = stepId;
    io.to(socket.roomId).emit('navigate-to-step', stepId);
  });

  socket.on('update-config', (config) => {
    if (roomConfigs[socket.roomId]) {
      roomConfigs[socket.roomId].slots = config.slots;
      roomConfigs[socket.roomId].theme = config.theme;
    }
    io.to(socket.roomId).emit('config-updated', config);
  });

  socket.on('start-countdown', () => io.to(socket.roomId).emit('trigger-countdown'));
  socket.on('send-photos', (photos) => socket.to(socket.roomId).emit('receive-partner-photos', photos));
  socket.on('add-sticker', (data) => io.to(socket.roomId).emit('sticker-added', data));
  socket.on('update-sticker-pos', (data) => io.to(socket.roomId).emit('sticker-moved', data));
  socket.on('update-frame-text', (text) => io.to(socket.roomId).emit('frame-text-updated', text));
  socket.on('update-font-style', (fontClass) => io.to(socket.roomId).emit('font-style-updated', fontClass));
  socket.on('update-text-pos', (pos) => io.to(socket.roomId).emit('text-pos-moved', pos));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
