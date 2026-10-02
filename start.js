// Long-running server for local development and Docker.
// Vercel uses server.js instead (a serverless handler with no listen and no WebSockets).
require('dotenv').config();
const http = require('http');
const connectDB = require('./src/config/db');
const app = require('./src/app');
const { initSocket } = require('./src/socket');

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  const server = http.createServer(app);
  initSocket(server);
  server.listen(PORT, () => console.log(`🚀 Collabify API on http://localhost:${PORT}`));

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
