require('dotenv').config();
const connectDB = require('./src/config/db');
const app = require('./src/app');

// Ensure DB is connected before handling any request
let dbConnected = false;

const ensureDB = async () => {
  if (!dbConnected) {
    await connectDB();
    dbConnected = true;
  }
};

// Wrap app to ensure DB connection on every cold start
const handler = async (req, res) => {
  await ensureDB();
  app(req, res);
};

module.exports = handler;
