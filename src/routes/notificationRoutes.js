import express from 'express';
import Notification from '../models/Notification.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  validateObjectId,
  validatePagination,
  handleValidationErrors,
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// All notification routes require authentication
router.use(authenticate);

// @desc    Get user's notifications
// @route   GET /api/notifications
// @access  Private
router.get('/', validatePagination, asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    type,
    isRead,
    priority 
  } = req.query;

  const query = { recipient: req.user._id };
  
  if (type && type !== 'all') {
    query.type = type;
  }
  
  if (isRead !== undefined) {
    query.isRead = isRead === 'true';
  }
  
  if (priority && priority !== 'all') {
    query.priority = priority;
  }

  const notifications = await Notification.find(query)
    .populate('sender', 'name username avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false,
  });

  res.status(200).json({
    success: true,
    data: notifications,
    meta: {
      unreadCount,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    },
  });
}));

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
router.put('/:id/read', validateObjectId, asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found',
    });
  }

  // Check if user owns the notification
  if (notification.recipient.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this notification',
    });
  }

  await notification.markAsRead();

  res.status(200).json({
    success: true,
    message: 'Notification marked as read',
  });
}));

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
router.put('/mark-all-read', asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  res.status(200).json({
    success: true,
    message: 'All notifications marked as read',
  });
}));

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
router.delete('/:id', validateObjectId, asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found',
    });
  }

  // Check if user owns the notification
  if (notification.recipient.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this notification',
    });
  }

  await Notification.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Notification deleted successfully',
  });
}));

// @desc    Get notification preferences
// @route   GET /api/notifications/preferences
// @access  Private
router.get('/preferences', asyncHandler(async (req, res) => {
  // Return user's notification preferences (stored in User model)
  const user = await User.findById(req.user._id).select('notificationPreferences');

  const defaultPreferences = {
    email: {
      newMessages: true,
      connectionRequests: true,
      badgeEarned: true,
      eventReminders: true,
      courseUpdates: true,
      weeklyDigest: true,
    },
    push: {
      newMessages: true,
      connectionRequests: true,
      badgeEarned: true,
      eventReminders: false,
      courseUpdates: false,
    },
  };

  res.status(200).json({
    success: true,
    data: user.notificationPreferences || defaultPreferences,
  });
}));

// @desc    Update notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
router.put('/preferences', [
  body('email').optional().isObject().withMessage('Email preferences must be an object'),
  body('push').optional().isObject().withMessage('Push preferences must be an object'),
  handleValidationErrors,
], asyncHandler(async (req, res) => {
  const { email, push } = req.body;

  const user = await User.findById(req.user._id);
  
  if (!user.notificationPreferences) {
    user.notificationPreferences = {};
  }

  if (email) {
    user.notificationPreferences.email = { ...user.notificationPreferences.email, ...email };
  }

  if (push) {
    user.notificationPreferences.push = { ...user.notificationPreferences.push, ...push };
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Notification preferences updated successfully',
    data: user.notificationPreferences,
  });
}));

// Admin routes
router.use(authorize('admin'));

// @desc    Send notification to users
// @route   POST /api/notifications/send
// @access  Private (Admin)
router.post('/send', [
  body('recipients').isArray().withMessage('Recipients must be an array'),
  body('type').isIn([
    'welcome', 'connection_request', 'connection_accepted', 'message',
    'post_like', 'post_comment', 'event_reminder', 'course_completed',
    'badge_earned', 'level_up', 'challenge_completed', 'reward_available',
    'admin_message', 'system'
  ]).withMessage('Invalid notification type'),
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title must be between 1 and 100 characters'),
  body('message').trim().isLength({ min: 1, max: 500 }).withMessage('Message must be between 1 and 500 characters'),
  handleValidationErrors,
], asyncHandler(async (req, res) => {
  const { recipients, type, title, message, data, actionUrl, priority = 'normal' } = req.body;

  const notifications = recipients.map(userId => ({
    recipient: userId,
    sender: req.user._id,
    type,
    title,
    message,
    data,
    actionUrl,
    priority,
  }));

  await Notification.insertMany(notifications);

  res.status(201).json({
    success: true,
    message: `Notifications sent to ${recipients.length} users`,
    count: recipients.length,
  });
}));

// @desc    Get notification analytics
// @route   GET /api/notifications/analytics
// @access  Private (Admin)
router.get('/analytics', asyncHandler(async (req, res) => {
  const { timeframe = '30d' } = req.query;

  let dateFilter = {};
  const now = new Date();
  
  switch (timeframe) {
    case '7d':
      dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      break;
    case '30d':
      dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      break;
    case '90d':
      dateFilter = { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
      break;
  }

  const [
    totalNotifications,
    notificationsByType,
    readRate,
    notificationsByPriority,
  ] = await Promise.all([
    Notification.countDocuments({ createdAt: dateFilter }),
    Notification.aggregate([
      { $match: { createdAt: dateFilter } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Notification.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          read: { $sum: { $cond: ['$isRead', 1, 0] } },
        }
      },
      {
        $project: {
          readRate: { $multiply: [{ $divide: ['$read', '$total'] }, 100] }
        }
      }
    ]),
    Notification.aggregate([
      { $match: { createdAt: dateFilter } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      timeframe,
      totalNotifications,
      notificationsByType,
      readRate: readRate[0]?.readRate || 0,
      notificationsByPriority,
    },
  });
}));

export default router;