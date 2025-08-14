import express from 'express';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  validateObjectId,
  validatePagination,
  handleValidationErrors,
} from '../middleware/validation.js';

const router = express.Router();

// @desc    Get all users/members
// @route   GET /api/users
// @access  Private
router.get('/', authenticate, validatePagination, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    phase,
    sortBy = 'points'
  } = req.query;

  // Build query
  const query = {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
      { skills: { $in: [new RegExp(search, 'i')] } },
    ];
  }

  if (phase && phase !== 'all') {
    query.phase = phase;
  }

  // Build sort object
  let sort = {};
  switch (sortBy) {
    case 'points':
      sort = { points: -1 };
      break;
    case 'newest':
      sort = { createdAt: -1 };
      break;
    case 'alphabetical':
      sort = { name: 1 };
      break;
    case 'online':
      sort = { isOnline: -1, lastActive: -1 };
      break;
    default:
      sort = { points: -1 };
  }

  // Execute query with pagination
  const users = await User.find(query)
    .select('-password -resetPasswordToken -resetPasswordExpire -pointsHistory')
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

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

// @desc    Get single user profile
// @route   GET /api/users/:id
// @access  Private
router.get('/:id', authenticate, validateObjectId, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-password -resetPasswordToken -resetPasswordExpire')
    .populate('courses.courseId', 'title category phase');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Get user's rank
  const rank = await User.countDocuments({ points: { $gt: user.points } }) + 1;

  res.status(200).json({
    success: true,
    data: {
      ...user.toJSON(),
      rank,
    },
  });
}));

// @desc    Follow/unfollow user
// @route   PUT /api/users/:id/follow
// @access  Private
router.put('/:id/follow', authenticate, validateObjectId, asyncHandler(async (req, res) => {
  const targetUserId = req.params.id;
  const currentUserId = req.user._id;

  if (targetUserId === currentUserId.toString()) {
    return res.status(400).json({
      success: false,
      message: 'Cannot follow yourself',
    });
  }

  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Add following/followers logic here if needed
  // For now, we'll just return success

  res.status(200).json({
    success: true,
    message: 'Following status updated',
  });
}));

// @desc    Get user's posts
// @route   GET /api/users/:id/posts
// @access  Private
router.get('/:id/posts', authenticate, validateObjectId, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  const Post = (await import('../models/Post.js')).default;

  const posts = await Post.find({
    author: req.params.id,
    isApproved: true
  })
    .populate('author', 'name username avatar level isOnline')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Post.countDocuments({
    author: req.params.id,
    isApproved: true
  });

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

// @desc    Update user online status
// @route   PUT /api/users/status
// @access  Private
router.put('/status', authenticate, asyncHandler(async (req, res) => {
  const { isOnline } = req.body;

  const user = await User.findById(req.user._id);
  user.isOnline = isOnline;
  user.lastActive = new Date();
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Status updated successfully',
  });
}));

export default router;