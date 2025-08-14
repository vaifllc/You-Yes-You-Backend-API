import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './src/routes/authRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import postRoutes from './src/routes/postRoutes.js';
import courseRoutes from './src/routes/courseRoutes.js';
import eventRoutes from './src/routes/eventRoutes.js';
import leaderboardRoutes from './src/routes/leaderboardRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import uploadRoutes from './src/routes/uploadRoutes.js';
import resourceRoutes from './src/routes/resourceRoutes.js';
import messageRoutes from './src/routes/messageRoutes.js';
import connectionRoutes from './src/routes/connectionRoutes.js';
import moderationRoutes from './src/routes/moderationRoutes.js';
import adminSettingsRoutes from './src/routes/adminSettingsRoutes.js';
import challengeRoutes from './src/routes/challengeRoutes.js';
import rewardRoutes from './src/routes/rewardRoutes.js';
import badgeRoutes from './src/routes/badgeRoutes.js';
import integrationRoutes from './src/routes/integrationRoutes.js';
import chatbotRoutes from './src/routes/chatbotRoutes.js';
import webhookRoutes from './src/routes/webhookRoutes.js';
import pluginRoutes from './src/routes/pluginRoutes.js';
import calendarRoutes from './src/routes/calendarRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import analyticsRoutes from './src/routes/analyticsRoutes.js';
import searchRoutes from './src/routes/searchRoutes.js';
import fileRoutes from './src/routes/fileRoutes.js';
import siteRoutes from './src/routes/siteRoutes.js';

// Import middleware
import { errorHandler } from './src/middleware/errorHandler.js';
import { notFound } from './src/middleware/errorHandler.js';
import connectDB from './src/config/database.js';
import { scheduleDailyAutoMessages } from './src/utils/autoMessaging.js';
import cron from 'node-cron';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
});

// Speed limiting
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per windowMs without delay
  delayMs: 500, // add 500ms delay per request after delayAfter
});

app.use(limiter);
app.use(speedLimiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://youyesyou.com', 'https://www.youyesyou.com']
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'YOU YES YOU API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/plugins', pluginRoutes);
app.use('/api/calendar', calendarRoutes);
// (duplicates removed)
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/site', siteRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user to their personal room
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Handle real-time post updates
  socket.on('new_post', (postData) => {
    socket.broadcast.emit('post_created', postData);
  });

  // Handle real-time comments
  socket.on('new_comment', (commentData) => {
    socket.broadcast.emit('comment_added', commentData);
  });

  // Handle user online status
  socket.on('user_online', (userId) => {
    socket.broadcast.emit('user_status_changed', { userId, isOnline: true });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

// Database connection handled by src/config/database.js

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});

// Start server
const startServer = async () => {
  await connectDB();

  // Initialize auto-messaging scheduler
  scheduleDailyAutoMessages();

  // Schedule daily tasks
  cron.schedule('0 10 * * *', async () => {
    console.log('🕐 Running daily tasks...');

    // Send milestone messages
    const { sendMilestoneMessages } = await import('./src/utils/autoMessaging.js');
    await sendMilestoneMessages();

    // Check broken streaks
    const { checkBrokenStreaks } = await import('./src/utils/streakTracker.js');
    await checkBrokenStreaks();

    // Schedule event reminders
    try {
      const response = await fetch('http://localhost:' + PORT + '/api/calendar/schedule-reminders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PLATFORM_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('📅 Event reminders scheduled');
    } catch (error) {
      console.log('⚠️ Event reminder scheduling failed:', error.message);
    }
  });

  // Initialize Socket.IO in controllers to avoid circular dependency
  const messageController = await import('./src/controllers/messageController.js');
  const connectionController = await import('./src/controllers/connectionController.js');

  // Pass io instance to controllers that need it
  if (messageController.setSocketIO) messageController.setSocketIO(io);
  if (connectionController.setSocketIO) connectionController.setSocketIO(io);

  server.listen(PORT, () => {
    console.log(`🚀 YOU YES YOU API Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  });
};

startServer();

export { io };