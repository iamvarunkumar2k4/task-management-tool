require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const taskRoutes = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/api/tasks', taskRoutes);

app.get('/', (req, res) => {
  res.send('Task Tracker API is running');
});

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const normalizeOrigin = (origin) => (origin ? origin.replace(/\/$/, '') : origin);
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const normalizedOrigin = normalizeOrigin(origin);
  return allowedOrigins.some((allowedOrigin) => normalizeOrigin(allowedOrigin) === normalizedOrigin);
};

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.locals.io = io;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected', process.env.MONGO_URI);
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB connection failed', err);
    process.exit(1);
  });
