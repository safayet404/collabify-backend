let io = null;

const initSocket = (server) => {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin:      process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
      methods:     ['GET', 'POST'],
    },
  });
  console.log('⚡ Socket.IO initialized');
  return io;
};

const getIO    = () => io;

// Safe emit helpers — no crash if socket not initialized
const emitToBoard     = (boardId, event, data) => { try { io?.to(`board:${boardId}`).emit(event, data); } catch {} };
const emitToWorkspace = (wsId, event, data)    => { try { io?.to(`workspace:${wsId}`).emit(event, data); } catch {} };
const emitToUser      = (userId, event, data)  => { try { io?.to(`user:${userId}`).emit(event, data); } catch {} };
const joinBoard       = () => {};
const leaveBoard      = () => {};
const joinWorkspace   = () => {};

module.exports = { initSocket, getIO, emitToBoard, emitToWorkspace, emitToUser, joinBoard, leaveBoard, joinWorkspace };
