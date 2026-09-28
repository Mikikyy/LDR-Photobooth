const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
  maxHttpBufferSize: 1e7,
  pingTimeout: 30000,
  pingInterval: 10000,
  // เฟรมภาพเป็น JPEG (บีบอัดแล้ว) การเปิด per-message-deflate จะเสีย CPU/เวลาไปบีบอัดซ้ำโดยไม่ได้อะไร
  // และเป็นสาเหตุหนึ่งของความหน่วงที่สะสมขึ้นเรื่อยๆ บนคอนเนกชันที่ latency สูงแบบ LDR
  perMessageDeflate: false,
  // ตัด long-polling fallback ออก ให้ต่อผ่าน websocket ทางเดียว ลด overhead การ handshake/upgrade
  transports: ['websocket']
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const roomConfigs = {};

io.on('connection', (socket) => {

  const updateRoomState = (roomId) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    const userCount = room ? room.size : 0;

    io.to(roomId).emit('room-status', { 
      userCount: userCount, 
      config: roomConfigs[roomId] 
    });

    // เมื่อเข้าครบ 2 คน เปลี่ยนไปหน้า Step 2 พร้อมกันทันที
    if (userCount >= 2 && roomConfigs[roomId] && roomConfigs[roomId].currentStep === 'step1') {
      roomConfigs[roomId].currentStep = 'step2';
      io.to(roomId).emit('navigate-to-step', 'step2');
    }
  };

  socket.on('join-room', (roomId) => {
    if (socket.roomId && socket.roomId !== roomId) {
      socket.leave(socket.roomId);
    }

    const alreadyIn = socket.rooms.has(roomId);
    socket.join(roomId);
    socket.roomId = roomId;

    if (!roomConfigs[roomId]) {
      roomConfigs[roomId] = { slots: 3, theme: 'theme-pastel', currentStep: 'step1' };
    }

    updateRoomState(roomId);

    // ครบ 2 คน -> ให้คนที่อยู่ในห้องก่อนเริ่มเชื่อมต่อ WebRTC
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!alreadyIn && room && room.size === 2) socket.to(roomId).emit('start-call');
  });

  // Signaling สำหรับ WebRTC (วิดีโอจริงจะวิ่งตรงระหว่างสองเครื่อง ไม่ผ่านเซิร์ฟเวอร์)
  socket.on('webrtc-signal', (data) => {
    if (socket.roomId) socket.to(socket.roomId).emit('webrtc-signal', data);
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

  socket.on('disconnecting', () => {
    if (socket.roomId) {
      const roomId = socket.roomId;
      setTimeout(() => updateRoomState(roomId), 300);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
