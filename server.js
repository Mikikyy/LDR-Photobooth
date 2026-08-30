const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e7
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const rooms = {};

io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;

    if (!rooms[roomId]) {
      rooms[roomId] = { 
        users: [], 
        config: { slots: 3, theme: 'theme-pastel' },
        stickers: [],
        customText: 'Distance means so little ❤️'
      };
    }

    if (!rooms[roomId].users.includes(socket.id)) {
      rooms[roomId].users.push(socket.id);
    }

    const userCount = rooms[roomId].users.length;
    
    // แจ้งสถานะผู้ใช้งานในห้องให้ทุกคนในห้องทราบ real-time
    io.to(roomId).emit('room-status', { userCount, config: rooms[roomId].config });

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

    // ซิงก์การตกแต่งสติ๊กเกอร์ real-time
    socket.on('add-sticker', (stickerData) => {
      if (rooms[roomId]) {
        rooms[roomId].stickers.push(stickerData);
        io.to(roomId).emit('sticker-added', stickerData);
      }
    });

    socket.on('update-sticker-pos', (data) => {
      io.to(roomId).emit('sticker-moved', data);
    });

    // ซิงก์การพิมพ์ข้อความท้ายกรอบรูป real-time
    socket.on('update-frame-text', (text) => {
      if (rooms[roomId]) {
        rooms[roomId].customText = text;
        io.to(roomId).emit('frame-text-updated', text);
      }
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
