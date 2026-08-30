const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e7 // รองรับไฟล์ภาพถ่ายขนาดใหญ่
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// เก็บข้อมูลผู้เล่นในแต่ละห้อง
const rooms = {};

io.on('connection', (socket) => {
  
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;

    if (!rooms[roomId]) {
      rooms[roomId] = { users: [], config: { slots: 3, theme: 'theme-pastel' } };
    }

    rooms[roomId].users.push(socket.id);
    const userCount = rooms[roomId].users.length;

    // แจ้งจำนวนคนที่อยู่ในห้องปัจจุบัน
    io.to(roomId).emit('room-status', { userCount, config: rooms[roomId].config });

    // ซิงก์การเลือก Theme และจำนวนช่อง
    socket.on('update-config', (config) => {
      rooms[roomId].config = config;
      io.to(roomId).emit('config-updated', config);
    });

    // เริ่มนับถอยหลังถ่ายรูปพร้อมกัน
    socket.on('start-countdown', () => {
      io.to(roomId).emit('trigger-countdown');
    });

    // ส่งชุดรูปถ่ายให้อีกฝั่ง
    socket.on('send-photos', (photos) => {
      socket.to(roomId).emit('receive-partner-photos', photos);
    });
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId].users = rooms[roomId].users.filter(id => id !== socket.id);
      io.to(roomId).emit('room-status', { userCount: rooms[roomId].users.length, config: rooms[roomId].config });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
