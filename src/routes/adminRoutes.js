import express from 'express';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Course from '../models/Course.js';
import Event from '../models/Event.js';
import Feedback from '../models/Feedback.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateObjectId, validatePagination, handleValidationErrors } from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
router.get('/dashboard', asyncHandler(async (req, res) => {
  // Get basic stats
  const [
    totalUsers,
    totalPosts,
    totalCourses,
    totalEvents,
    activeUsers,
    recentUsers,
    recentPosts,
    upcomingEvents,
  ] = await Promise.all([
    User.countDocuments(),
    Post.countDocuments({ isApproved: true }),
    Course.countDocuments({ isPublished: true }),
    Event.countDocuments({ status: 'scheduled', date: { $gte: new Date() } }),
    User.countDocuments({ isOnline: true }),
    User.find().sort({ createdAt: -1 }).limit(5).select('name username avatar createdAt'),
    Post.find({ isApproved: true }).sort({ createdAt: -1 }).limit(5)
      .populate('author', 'name username avatar'),
    Event.find({ status: 'scheduled', date: { $gte: new Date() } })
      .sort({ date: 1 }).limit(5),
  ]);

  // Get feedback stats
  const Feedback = (await import('../models/Feedback.js')).default;
  const feedbackStats = await Feedback.getFeedbackStats();

  // Get user growth (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const newUsersLast30Days = await User.countDocuments({
    createdAt: { $gte: thirtyDaysAgo }
  });

  // Get phase distribution
  const phaseDistribution = await User.aggregate([
    { $group: { _id: '$phase', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  // Get top contributors
  const topContributors = await User.find()
    .sort({ points: -1 })
    .limit(5)
    .select('name username avatar points level');

  // Get recent activity
  const recentActivity = await Post.find({ isApproved: true })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('author', 'name username')
    .select('content author createdAt category');

  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalUsers,
        totalPosts,
        totalCourses,
        totalEvents,
        activeUsers,
        newUsersLast30Days,
        feedback: feedbackStats,
      },
      charts: {
        phaseDistribution,
      },
      recent: {
        users: recentUsers,
        posts: recentPosts,
        events: upcomingEvents,
        activity: recentActivity,
      },
      topContributors,
    },
  });
}));

// @desc    Get all users for admin management
// @route   GET /api/admin/users
// @access  Private (Admin)
router.get('/users', validatePagination, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    phase,
    role,
    status = 'all'
  } = req.query;

  // Build query
  const query = {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  if (phase && phase !== 'all') {
    query.phase = phase;
  }

  if (role && role !== 'all') {
    query.role = role;
  }

  if (status === 'online') {
    query.isOnline = true;
  } else if (status === 'offline') {
    query.isOnline = false;
  }

  // Execute query with pagination
  const users = await User.find(query)
    .select('-password -resetPasswordToken -resetPasswordExpire')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  // Get total count for pagination
  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    data: users,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
}));

// @desc    Update user (Admin)
// @route   PUT /api/admin/users/:id
// @access  Private (Admin)
router.put('/users/:id', validateObjectId, asyncHandler(async (req, res) => {
  const { role, phase, points, level, email, name, username, bio, location, emailVerified, isBanned, isSuspended } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Update allowed fields
  if (role && ['user', 'admin'].includes(role)) {
    user.role = role;
  }

  if (phase && ['Phase 1', 'Phase 2', 'Phase 3'].includes(phase)) {
    user.phase = phase;
  }

  if (points !== undefined && points >= 0) {
    const pointsDiff = points - user.points;
    user.points = points;

    if (pointsDiff !== 0) {
      user.pointsHistory.push({
        action: 'Admin adjustment',
        points: pointsDiff,
        timestamp: new Date(),
      });
    }
  }

  if (level && ['New Member', 'Builder', 'Overcomer', 'Mentor-in-Training', 'Legacy Leader'].includes(level)) {
    user.level = level;
  }

  if (typeof email === 'string' && email.trim()) user.email = email.trim();
  if (typeof name === 'string' && name.trim()) user.name = name.trim();
  if (typeof username === 'string' && username.trim()) user.username = username.trim();
  if (typeof bio === 'string') user.bio = bio;
  if (typeof location === 'string') user.location = location;
  if (typeof emailVerified === 'boolean') user.emailVerified = emailVerified;

  // Account status controls
  if (isBanned === true) {
    user.warnings.push({ type: 'banned', reason: 'Admin ban', issuedBy: req.user._id, issuedAt: new Date(), isActive: true });
  }
  if (isSuspended === true) {
    user.warnings.push({ type: 'suspension', reason: 'Admin suspension', issuedBy: req.user._id, issuedAt: new Date(), isActive: true, expiresAt: new Date(Date.now() + 7*24*60*60*1000) });
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: user,
  });
}));

// @desc    Delete user (Admin)
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
router.delete('/users/:id', validateObjectId, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Prevent admin from deleting themselves
  if (user._id.toString() === req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete your own account',
    });
  }

  await User.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'User deleted successfully',
  });
}));

// @desc    Get pending posts for moderation
// @route   GET /api/admin/posts/pending
// @access  Private (Admin)
router.get('/posts/pending', validatePagination, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const posts = await Post.find({ isApproved: false })
    .populate('author', 'name username avatar level')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Post.countDocuments({ isApproved: false });

  res.status(200).json({
    success: true,
    data: posts,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
}));

// @desc    Approve/reject post
// @route   PUT /api/admin/posts/:id/moderate
// @access  Private (Admin)
router.put('/posts/:id/moderate', validateObjectId, asyncHandler(async (req, res) => {
  const { action } = req.body; // 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Must be "approve" or "reject"',
    });
  }

  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  if (action === 'approve') {
    post.isApproved = true;
    await post.save();
  } else {
    await Post.findByIdAndDelete(req.params.id);
  }

  res.status(200).json({
    success: true,
    message: `Post ${action}d successfully`,
  });
}));

// @desc    Get system analytics
// @route   GET /api/admin/analytics
// @access  Private (Admin)
router.get('/analytics', asyncHandler(async (req, res) => {
  const { timeframe = '30d' } = req.query;

  // Calculate date range
  let dateRange = {};
  const now = new Date();

  switch (timeframe) {
    case '7d':
      dateRange = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      break;
    case '30d':
      dateRange = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      break;
    case '90d':
      dateRange = { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
      break;
    default:
      dateRange = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  }

  // Get analytics data
  const [
    userGrowth,
    postActivity,
    courseEngagement,
    eventAttendance,
    topCategories,
  ] = await Promise.all([
    // User growth over time
    User.aggregate([
      { $match: { createdAt: dateRange } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),

    // Post activity
    Post.aggregate([
      { $match: { createdAt: dateRange } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),

    // Course engagement
    User.aggregate([
      { $unwind: '$courses' },
      { $match: { 'courses.enrolledAt': dateRange } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$courses.enrolledAt' } },
          enrollments: { $sum: 1 },
          avgProgress: { $avg: '$courses.progress' }
        }
      },
      { $sort: { _id: 1 } }
    ]),

    // Event attendance
    Event.aggregate([
      { $match: { date: dateRange } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          events: { $sum: 1 },
          totalAttendees: { $sum: { $size: '$attendees' } }
        }
      },
      { $sort: { _id: 1 } }
    ]),

    // Top post categories
    Post.aggregate([
      { $match: { createdAt: dateRange, isApproved: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      timeframe,
      userGrowth,
      postActivity,
      courseEngagement,
      eventAttendance,
      topCategories,
    },
  });
}));

// @desc    Bulk update users
// @route   PUT /api/admin/users/bulk
// @access  Private (Admin)
router.put('/users/bulk', asyncHandler(async (req, res) => {
  const { userIds, updates } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'User IDs array is required',
    });
  }

  if (!updates || Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Updates object is required',
    });
  }

  // Validate update fields
  const allowedFields = ['role', 'phase', 'level'];
  const updateFields = {};

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      updateFields[key] = updates[key];
    }
  });

  if (Object.keys(updateFields).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid update fields provided',
    });
  }

  // Perform bulk update
  const result = await User.updateMany(
    { _id: { $in: userIds } },
    { $set: updateFields }
  );

  res.status(200).json({
    success: true,
    message: `Successfully updated ${result.modifiedCount} users`,
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    },
  });
}));

// @desc    Generate invite codes
// @route   POST /api/admin/invites
// @access  Private (Admin)
router.post('/invites', asyncHandler(async (req, res) => {
  const { count = 1, expiresIn = '7d' } = req.body;

  // For now, just return mock invite codes
  // In production, you'd store these in the database
  const invites = Array.from({ length: count }, (_, i) => ({
    code: `YOUYESYOU-${Date.now()}-${i}`,
    createdBy: req.user._id,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    used: false,
  }));

  res.status(201).json({
    success: true,
    message: `Generated ${count} invite code(s)`,
    data: invites,
  });
}));

// @desc    Get feedback management data
// @route   GET /api/admin/feedback
// @access  Private (Admin)
router.get('/feedback', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, category, priority, type, search } = req.query;

  const filters = {
    status: status || 'all',
    category: category || 'all',
    priority: priority || 'all',
    type: type || 'all',
    search: search || '',
    isAdmin: true
  };

  const query = await Feedback.getFeedbackWithFilters(filters);

  const feedback = await Feedback.find(query)
    .populate('author', 'name username avatar')
    .populate('assignedTo', 'name username avatar')
    .populate('responses.author', 'name username avatar role')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  const total = await Feedback.countDocuments(query);

  res.status(200).json({
    success: true,
    data: feedback,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
}));

export default router;