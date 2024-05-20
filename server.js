const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
}, app);

const io = socketIo(server, {
  cors: {
    origin: '*', // Allow all origins
    methods: ['GET', 'POST']
  }
});

// Use CORS middleware
app.use(cors());

let users = [];
let messageHistory = [];
let typingUsers = {};

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('join', ({ username, gender }) => {
    const user = { id: socket.id, username, gender };
    users.push(user);
    io.emit('userList', users); // Emit user list to all clients
    socket.emit('messageHistory', messageHistory);
  });

  socket.on('message', (msg) => {
    const message = { ...msg, id: Date.now(), status: 'sent' };
    messageHistory.push(message);
    io.emit('message', message);
  });

  socket.on('privateMessage', ({ recipient, text }) => {
    const sender = users.find(user => user.id === socket.id);
    const recipientUser = users.find(user => user.username === recipient);
    if (recipientUser) {
      const message = { from: sender.username, to: recipient, text, id: Date.now(), status: 'sent' };
      io.to(recipientUser.id).emit('privateMessage', message);
      socket.emit('privateMessage', { ...message, own: true });
    }
  });

  socket.on('readMessage', (messageId) => {
    messageHistory = messageHistory.map(msg => {
      if (msg.id === messageId) {
        return { ...msg, status: 'read' };
      }
      return msg;
    });
    io.emit('messageStatus', { id: messageId, status: 'read' });
  });

  socket.on('typing', ({ from, to, typing }) => {
    const recipientUser = users.find(user => user.username === to);
    if (recipientUser) {
      typingUsers[recipientUser.id] = typing ? socket.id : null;
      io.to(recipientUser.id).emit('typing', { from, typing });
    }
  });

  socket.on('tipRequest', ({ from, to, amount, reason }) => {
    const recipientUser = users.find(user => user.username === to);
    if (recipientUser) {
      io.to(recipientUser.id).emit('tipRequest', { from, amount, reason });
    }
  });

  socket.on('screenShareRequest', ({ from, to }) => {
    const recipientUser = users.find(user => user.username === to);
    if (recipientUser) {
      io.to(recipientUser.id).emit('screenShareRequest', { from });
    }
  });

  socket.on('screenShareResponse', ({ from, to, accept }) => {
    const requesterUser = users.find(user => user.username === from);
    if (requesterUser) {
      io.to(requesterUser.id).emit('screenShareResponse', { to, accept });
    }
  });

  socket.on('screenShareStream', ({ to, stream }) => {
    const recipientUser = users.find(user => user.username === to);
    if (recipientUser) {
      io.to(recipientUser.id).emit('screenShareStream', { from: socket.id, stream });
    }
  });

  socket.on('stopScreenShare', ({ to }) => {
    const recipientUser = users.find(user => user.username === to);
    if (recipientUser) {
      io.to(recipientUser.id).emit('stopScreenShare');
    }
  });

  socket.on('disconnect', () => {
    users = users.filter((user) => user.id !== socket.id);
    io.emit('userList', users);
  });
});

app.get('/', (req, res) => {
  res.send('This is the backend server. The frontend is running on http://localhost:3001.');
});

server.listen(5000, () => {
  console.log('Server is running on port 5000');
});
