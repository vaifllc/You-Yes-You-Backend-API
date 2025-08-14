import express from 'express';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Course from '../models/Course.js';
import Event from '../models/Event.js';
import Resource from '../models/Resource.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validatePagination } from '../middleware/validation.js';

const router = express.Router();

// @desc    Global search across all content
// @route   GET /api/search
// @access  Private
router.get('/', authenticate, validatePagination, asyncHandler(async (req, res) => {
  const { 
    q: query, 
    type = 'all',
    page = 1, 
    limit = 20 
  } = req.query;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Search query must be at least 2 characters long',
    });
  }

  const searchRegex = new RegExp(query, 'i');
  const results = {};

  try {
    if (type === 'all' || type === 'posts') {
      results.posts = await Post.find({
        $and: [
          { isApproved: true },
          {
            $or: [
              { content: searchRegex },
              { tags: { $in: [searchRegex] } },
              { category: searchRegex },
            ]
          }
        ]
      })
      .populate('author', 'name username avatar level')
      .limit(type === 'posts' ? limit : 5)
      .sort({ createdAt: -1 });
    }

    if (type === 'all' || type === 'users') {
      results.users = await User.find({
        $or: [
          { name: searchRegex },
          { username: searchRegex },
          { bio: searchRegex },
          { skills: { $in: [searchRegex] } },
        ]
      })
      .select('name username avatar bio location phase level points isOnline')
      .limit(type === 'users' ? limit : 5)
      .sort({ points: -1 });
    }

    if (type === 'all' || type === 'courses') {
      results.courses = await Course.find({
        $and: [
          { isPublished: true },
          {
            $or: [
              { title: searchRegex },
              { description: searchRegex },
              { instructor: searchRegex },
              { skills: { $in: [searchRegex] } },
            ]
          }
        ]
      })
      .select('title description category level instructor estimatedDuration enrollmentCount rating')
      .limit(type === 'courses' ? limit : 5)
      .sort({ enrollmentCount: -1 });
    }

    if (type === 'all' || type === 'events') {
      results.events = await Event.find({
        $and: [
          { status: 'scheduled', date: { $gte: new Date() } },
          {
            $or: [
              { title: searchRegex },
              { description: searchRegex },
              { instructor: searchRegex },
              { type: searchRegex },
            ]
          }
        ]
      })
      .select('title description date duration type instructor maxAttendees')
      .limit(type === 'events' ? limit : 5)
      .sort({ date: 1 });
    }

    if (type === 'all' || type === 'resources') {
      // Check phase access for resources
      const phaseAccess = req.user.phase;
      results.resources = await Resource.find({
        $and: [
          { status: 'approved' },
          {
            $or: [
              { 'eligibility.phaseAccess': 'All Phases' },
              { 'eligibility.phaseAccess': phaseAccess },
            ]
          },
          {
            $or: [
              { title: searchRegex },
              { description: searchRegex },
              { category: searchRegex },
              { tags: { $in: [searchRegex] } },
            ]
          }
        ]
      })
      .select('title description category type location rating featured verified')
      .limit(type === 'resources' ? limit : 5)
      .sort({ featured: -1, 'rating.average': -1 });
    }

    // Calculate total results for pagination
    const totalResults = Object.values(results).reduce((total, items) => total + items.length, 0);

    res.status(200).json({
      success: true,
      query,
      type,
      data: results,
      meta: {
        totalResults,
        hasResults: totalResults > 0,
        searchTime: new Date().toISOString(),
      },
      pagination: type !== 'all' ? {
        current: parseInt(page),
        limit: parseInt(limit),
        hasMore: totalResults >= limit,
      } : undefined,
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message,
    });
  }
}));

// @desc    Get search suggestions
// @route   GET /api/search/suggestions
// @access  Private
router.get('/suggestions', authenticate, asyncHandler(async (req, res) => {
  const { q: query } = req.query;

  if (!query || query.length < 2) {
    return res.status(200).json({
      success: true,
      data: {
        suggestions: [],
        trending: [
          'morning routine',
          'financial planning',
          'entrepreneurship',
          'parenting tips',
          'job search',
          'credit repair',
        ],
      },
    });
  }

  const searchRegex = new RegExp(query, 'i');

  const [
    userSuggestions,
    tagSuggestions,
    courseSuggestions,
  ] = await Promise.all([
    // User suggestions
    User.find({ name: searchRegex })
      .select('name username')
      .limit(3),
    
    // Tag suggestions from posts
    Post.aggregate([
      { $match: { tags: { $in: [searchRegex] } } },
      { $unwind: '$tags' },
      { $match: { tags: searchRegex } },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    
    // Course suggestions
    Course.find({
      $and: [
        { isPublished: true },
        { title: searchRegex }
      ]
    })
    .select('title')
    .limit(3),
  ]);

  const suggestions = [
    ...userSuggestions.map(user => ({ type: 'user', text: user.name, username: user.username })),
    ...tagSuggestions.map(tag => ({ type: 'tag', text: `#${tag._id}` })),
    ...courseSuggestions.map(course => ({ type: 'course', text: course.title })),
  ];

  res.status(200).json({
    success: true,
    data: {
      suggestions: suggestions.slice(0, 8),
      query,
    },
  });
}));

// @desc    Get trending topics
// @route   GET /api/search/trending
// @access  Private
router.get('/trending', authenticate, asyncHandler(async (req, res) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    trendingTags,
    popularPosts,
    activeUsers,
    upcomingEvents,
  ] = await Promise.all([
    // Trending tags from recent posts
    Post.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, isApproved: true } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    
    // Most popular posts this week
    Post.find({
      createdAt: { $gte: sevenDaysAgo },
      isApproved: true,
    })
    .populate('author', 'name username avatar')
    .sort({ likes: -1 })
    .limit(5)
    .select('content category likes comments createdAt'),
    
    // Most active users this week
    User.find({
      lastActive: { $gte: sevenDaysAgo }
    })
    .sort({ points: -1 })
    .limit(5)
    .select('name username avatar level points'),
    
    // Upcoming events
    Event.find({
      status: 'scheduled',
      date: { $gte: new Date() }
    })
    .sort({ date: 1 })
    .limit(3)
    .select('title date type maxAttendees'),
  ]);

  res.status(200).json({
    success: true,
    data: {
      trendingTags: trendingTags.map(tag => ({
        tag: tag._id,
        posts: tag.count,
      })),
      popularPosts,
      activeUsers,
      upcomingEvents,
      lastUpdated: new Date().toISOString(),
    },
  });
}));

export default router;