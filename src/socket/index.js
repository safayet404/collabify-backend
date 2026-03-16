const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin:      process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
      methods:     ['GET', 'POST'],
    },
    pingTimeout:  60000,
    pingInterval: 25000,
  });

  // ── Auth middleware ──────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const User    = require('../modules/auth/user.model');
      const user    = await User.findById(decoded.id).select('_id name email avatar');

      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection handler ───────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.user.name} (${socket.id})`);

    // Join personal room for notifications
    socket.join(`user:${socket.user._id}`);

    // ── Board room management ────────────────────────────────
    socket.on('board:join', (boardId) => {
      socket.join(`board:${boardId}`);
      socket.to(`board:${boardId}`).emit('board:user-joined', {
        userId:   socket.user._id,
        name:     socket.user.name,
        avatar:   socket.user.avatar,
        socketId: socket.id,
      });
      console.log(`${socket.user.name} joined board:${boardId}`);
    });

    socket.on('board:leave', (boardId) => {
      socket.leave(`board:${boardId}`);
      socket.to(`board:${boardId}`).emit('board:user-left', {
        userId:   socket.user._id,
        socketId: socket.id,
      });
    });

    // ── Cursor tracking ──────────────────────────────────────
    socket.on('cursor:move', ({ boardId, x, y }) => {
      socket.to(`board:${boardId}`).emit('cursor:moved', {
        userId: socket.user._id,
        name:   socket.user.name,
        avatar: socket.user.avatar,
        x, y,
      });
    });

    // ── Typing indicator ─────────────────────────────────────
    socket.on('card:typing', ({ cardId, boardId }) => {
      socket.to(`board:${boardId}`).emit('card:user-typing', {
        userId: socket.user._id,
        name:   socket.user.name,
        cardId,
      });
    });

    socket.on('card:stop-typing', ({ cardId, boardId }) => {
      socket.to(`board:${boardId}`).emit('card:user-stop-typing', {
        userId: socket.user._id,
        cardId,
      });
    });

    // ── Workspace room ───────────────────────────────────────
    socket.on('workspace:join', (workspaceId) => {
      socket.join(`workspace:${workspaceId}`);
    });

    // ── Disconnect ───────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.user.name} (${socket.id})`);
      // Notify all boards this user was in
      socket.rooms.forEach((room) => {
        if (room.startsWith('board:')) {
          socket.to(room).emit('board:user-left', {
            userId:   socket.user._id,
            socketId: socket.id,
          });
        }
      });
    });
  });

  console.log('⚡ Socket.IO initialized');
  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

// Emit helpers
const emitToBoard = (boardId, event, data) => {
  if (io) io.to(`board:${boardId}`).emit(event, data);
};

const emitToWorkspace = (workspaceId, event, data) => {
  if (io) io.to(`workspace:${workspaceId}`).emit(event, data);
};

const emitToUser = (userId, event, data) => {
  if (io) io.to(`user:${userId}`).emit(event, data);
};

module.exports = { initSocket, getIO, emitToBoard, emitToWorkspace, emitToUser };
