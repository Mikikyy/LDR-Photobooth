const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e7,
  cors: { origin: "*" }
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// เก็บข้อมูลผู้เล่นจริงตาม Socket ID
const rooms = {};

function updateRoomStatus(roomId) {
  if (!rooms[roomId]) return;
  
  // ดึงรายชื่อ socketid ที่อยู่ในห้องจริงๆ จาก Socket.io
  const clients = io.sockets.adapter.rooms.get(roomId);
  const userCount = clients ? clients.size : 0;
  
  io.to(roomId).emit('room-status', { 
    userCount: userCount, 
    config: rooms[roomId].config 
  });
}

io.on('connection', (socket) => {
  
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;

    if (!rooms[roomId]) {
      rooms[roomId] = { 
        config: { slots: 3, theme: 'theme-pastel' },
        stickers: [],
        customText: 'Distance means so little ❤️'
      };
    }

    // อัปเดตสถานะคนในห้องให้ทุกคนทันทีที่มีคน Join
    setTimeout(() => {
      updateRoomStatus(roomId);
    }, 300);

    // รองรับการร้องขอเช็กจำนวนคนแบบ Manual จากฝั่ง Client
    socket.on('check-status', () => {
      updateRoomStatus(roomId);
    });

    socket.on('change-step', (stepId) => {
      io.to(roomId).emit('navigate-to-step', stepId);
    });

    socket.on('update-config', (config) => {
      rooms[roomId].config = config;
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
      if (rooms[roomId]) {
        rooms[roomId].customText = text;
        io.to(roomId).emit('frame-text-updated', text);
      }
    });
  });

  socket.on('disconnecting', () => {
    const roomId = socket.roomId;
    if (roomId) {
      setTimeout(() => {
        updateRoomStatus(roomId);
      }, 300);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
