import express from 'express';
import User from '../models/User.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateLeaderboardQuery, validateObjectId } from '../middleware/validation.js';

const router = express.Router();

// @desc    Get leaderboard
// @route   GET /api/leaderboard
// @access  Private
router.get('/', authenticate, validateLeaderboardQuery, asyncHandler(async (req, res) => {
  const { 
    timeframe = 'all-time', 
    phase,
    page = 1, 
    limit = 50 
  } = req.query;

  // Build base query
  const matchQuery = {};
  
  if (phase && phase !== 'all') {
    matchQuery.phase = phase;
  }

  // Build date filter for timeframe
  let dateFilter = {};
  const now = new Date();
  
  switch (timeframe) {
    case 'weekly':
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      weekStart.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: weekStart } };
      break;
    case 'monthly':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { $gte: monthStart } };
      break;
    case 'all-time':
    default:
      dateFilter = {};
  }

  // For timeframe-specific leaderboards, we need to calculate points from activities
  let pipeline;
  
  if (timeframe === 'all-time') {
    // Simple query for all-time leaderboard
    pipeline = [
      { $match: matchQuery },
      {
        $addFields: {
          rank: {
            $add: [
              { $size: { $ifNull: [{ $filter: { input: '$pointsHistory', cond: { $gte: ['$$this.points', '$points'] } } }, []] } },
              1
            ]
          }
        }
      },
      { $sort: { points: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) },
      {
        $project: {
          name: 1,
          username: 1,
          avatar: 1,
          level: 1,
          phase: 1,
          points: 1,
          isOnline: 1,
          rank: 1,
        }
      }
    ];
  } else {
    // Calculate points for specific timeframe
    pipeline = [
      { $match: matchQuery },
      { $unwind: '$pointsHistory' },
      { $match: { 'pointsHistory.timestamp': dateFilter.createdAt } },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          username: { $first: '$username' },
          avatar: { $first: '$avatar' },
          level: { $first: '$level' },
          phase: { $first: '$phase' },
          isOnline: { $first: '$isOnline' },
          timeframePoints: { $sum: '$pointsHistory.points' },
          totalPoints: { $first: '$points' },
        }
      },
      { $sort: { timeframePoints: -1 } },
      {
        $group: {
          _id: null,
          users: { $push: '$$ROOT' },
        }
      },
      {
        $unwind: {
          path: '$users',
          includeArrayIndex: 'rank'
        }
      },
      {
        $addFields: {
          'users.rank': { $add: ['$rank', 1] }
        }
      },
      { $replaceRoot: { newRoot: '$users' } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) },
      {
        $project: {
          name: 1,
          username: 1,
          avatar: 1,
          level: 1,
          phase: 1,
          points: '$timeframePoints',
          totalPoints: 1,
          isOnline: 1,
          rank: 1,
        }
      }
    ];
  }

  const users = await User.aggregate(pipeline);

  // Get current user's position if authenticated
  let currentUserRank = null;
  if (req.user) {
    const currentUserPosition = await User.aggregate([
      { $match: matchQuery },
      { $sort: { points: -1 } },
      {
        $group: {
          _id: null,
          users: { $push: { _id: '$_id', points: '$points' } }
        }
      },
      { $unwind: { path: '$users', includeArrayIndex: 'rank' } },
      { $match: { 'users._id': req.user._id } },
      { $project: { rank: { $add: ['$rank', 1] } } }
    ]);

    currentUserRank = currentUserPosition[0]?.rank || null;
  }

  // Get total count
  const totalQuery = timeframe === 'all-time' ? matchQuery : {
    ...matchQuery,
    pointsHistory: { $elemMatch: { timestamp: dateFilter.createdAt } }
  };
  
  const total = await User.countDocuments(totalQuery);

  res.status(200).json({
    success: true,
    data: {
      leaderboard: users,
      currentUserRank,
      timeframe,
      phase: phase || 'all',
    },
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
}));

// @desc    Get user points history
// @route   GET /api/leaderboard/points/:userId
// @access  Private
router.get('/points/:userId', authenticate, validateObjectId, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  // Check if requesting own data or is admin
  if (userId !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this user\'s points history',
    });
  }

  const user = await User.findById(userId).select('pointsHistory');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Sort and paginate points history
  const sortedHistory = user.pointsHistory
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice((page - 1) * limit, page * limit);

  const total = user.pointsHistory.length;

  res.status(200).json({
    success: true,
    data: sortedHistory,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
}));

// @desc    Get points explanation/rules
// @route   GET /api/leaderboard/points-info
// @access  Public
router.get('/points-info', asyncHandler(async (req, res) => {
  const pointsRules = [
    { action: 'Daily Login', points: 2, description: 'Log in each day' },
    { action: 'Create Post', points: 5, description: 'Share content with the community' },
    { action: 'Comment on Post', points: 3, description: 'Engage with others\' posts' },
    { action: 'Complete Module', points: 10, description: 'Finish a course module' },
    { action: 'Complete Course', points: 50, description: 'Complete an entire course' },
    { action: 'Attend Event', points: 15, description: 'Participate in community events' },
    { action: 'Share Win', points: 20, description: 'Share a personal victory' },
    { action: 'Complete Challenge', points: 25, description: 'Complete weekly/monthly challenges' },
    { action: 'Account Registration', points: 10, description: 'Welcome bonus for joining' },
    { action: 'RSVP to Event', points: 5, description: 'Commit to attending an event' },
    { action: 'Like Post', points: 1, description: 'Show appreciation for content' },
  ];

  const levelInfo = [
    { level: 'New Member', range: '0-99 pts', description: 'Welcome to the community!' },
    { level: 'Builder', range: '100-249 pts', description: 'Building momentum and connections' },
    { level: 'Overcomer', range: '250-499 pts', description: 'Overcoming challenges and growing' },
    { level: 'Mentor-in-Training', range: '500-749 pts', description: 'Ready to help guide others' },
    { level: 'Legacy Leader', range: '750+ pts', description: 'Leading by example and creating lasting impact' },
  ];

  res.status(200).json({
    success: true,
    data: {
      pointsRules,
      levelInfo,
      message: 'Points are earned through active participation and growth within the community.',
    },
  });
}));

export default router;