import Feedback from '../models/Feedback.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { moderateContent } from '../utils/moderationUtils.js';

// @desc    Get all feedback with filters
// @route   GET /api/feedback
// @access  Private
export const getFeedback = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    category = 'all',
    status = 'all',
    priority = 'all',
    type = 'all',
    search = '',
    sortBy = 'recent',
    author,
    assignedTo
  } = req.query;

  const filters = {
    category,
    status,
    priority,
    type,
    search,
    author,
    assignedTo,
    isAdmin: req.user.role === 'admin'
  };

  const query = await Feedback.getFeedbackWithFilters(filters, req.user._id);

  // Build sort object
  let sortObj = {};
  switch (sortBy) {
    case 'recent':
      sortObj = { createdAt: -1 };
      break;
    case 'priority':
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      sortObj = { priority: -1, createdAt: -1 };
      break;
    case 'responses':
      sortObj = { 'responses.length': -1, createdAt: -1 };
      break;
    case 'alphabetical':
      sortObj = { title: 1 };
      break;
    case 'views':
      sortObj = { views: -1, createdAt: -1 };
      break;
    default:
      sortObj = { createdAt: -1 };
  }

  const feedback = await Feedback.find(query)
    .populate('author', 'name username avatar')
    .populate('assignedTo', 'name username avatar')
    .populate('responses.author', 'name username avatar role')
    .sort(sortObj)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Add user-specific data
  const feedbackWithUserData = feedback.map(item => ({
    ...item,
    isUserAuthor: item.author._id.toString() === req.user._id.toString(),
    isUserBookmarked: item.bookmarkedBy?.some(
      bookmark => bookmark.user.toString() === req.user._id.toString()
    ) || false,
    isUserFlagged: item.flaggedBy?.some(
      flag => flag.user._id.toString() === req.user._id.toString()
    ) || false,
    responseCount: item.responses?.length || 0
  }));

  const total = await Feedback.countDocuments(query);

  res.status(200).json({
    success: true,
    data: feedbackWithUserData,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Get single feedback item
// @route   GET /api/feedback/:id
// @access  Private
export const getFeedbackById = asyncHandler(async (req, res) => {
  const feedback = await Feedback.findById(req.params.id)
    .populate('author', 'name username avatar')
    .populate('assignedTo', 'name username avatar')
    .populate('responses.author', 'name username avatar role')
    .populate('bookmarkedBy.user', 'name username avatar')
    .populate('flaggedBy.user', 'name username avatar');

  if (!feedback) {
    return res.status(404).json({
      success: false,
      message: 'Feedback not found',
    });
  }

  // Check if user can view this feedback
  if (!feedback.moderationStatus.isApproved && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this feedback',
    });
  }

  // Increment view count
  await feedback.incrementViews();

  // Add user-specific data
  const feedbackWithUserData = {
    ...feedback.toObject(),
    isUserAuthor: feedback.author._id.toString() === req.user._id.toString(),
    isUserBookmarked: feedback.bookmarkedBy?.some(
      bookmark => bookmark.user._id.toString() === req.user._id.toString()
    ) || false,
    isUserFlagged: feedback.flaggedBy?.some(
      flag => flag.user._id.toString() === req.user._id.toString()
    ) || false,
    responseCount: feedback.responses?.length || 0
  };

  res.status(200).json({
    success: true,
    data: feedbackWithUserData,
  });
});

// @desc    Create new feedback
// @route   POST /api/feedback
// @access  Private
export const createFeedback = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    category,
    priority,
    type,
    tags,
    contactEmail,
    attachments
  } = req.body;

  // Content moderation
  const moderationResult = moderateContent(description, {
    strictMode: false,
    contextAware: true
  });

  // Create feedback
  const feedback = await Feedback.create({
    title,
    description,
    category,
    priority,
    priority,
    type,
    tags: tags || [],
    author: req.user._id,
    attachments: attachments || [],
    metadata: {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      platform: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop',
      browser: req.get('User-Agent')?.includes('Chrome') ? 'Chrome' : 'Other'
    },
    moderationStatus: {
      isApproved: !moderationResult.shouldBlock,
      moderationNotes: moderationResult.shouldFlag ? moderationResult.issues.join(', ') : ''
    }
  });

  await feedback.populate('author', 'name username avatar');

  // Award points for submitting feedback
  await req.user.addPoints(5, `Submitted feedback: ${title}`);

  // Send notification to admins if high priority
  if (priority === 'high' || priority === 'critical') {
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await Notification.create({
        recipient: admin._id,
        sender: req.user._id,
        type: 'feedback_alert',
        title: 'High Priority Feedback Submitted',
        message: `New ${priority} priority feedback: ${title}`,
        priority: 'high',
        metadata: {
          feedbackId: feedback._id,
          category: feedback.category,
          priority: feedback.priority
        }
      });
    }
  }

  // Trigger webhook for new feedback
  setTimeout(async () => {
    try {
      await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhooks/zapier/feedback_submitted`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.PLATFORM_API_KEY,
        },
        body: JSON.stringify({
          feedbackId: feedback._id,
          title: feedback.title,
          category: feedback.category,
          priority: feedback.priority,
          author: {
            id: req.user._id,
            name: req.user.name,
            username: req.user.username
          },
          submittedAt: feedback.createdAt
        }),
      });
    } catch (error) {
      console.log('Feedback webhook failed:', error.message);
    }
  }, 1000);

  res.status(201).json({
    success: true,
    message: 'Feedback submitted successfully',
    data: feedback,
    moderation: {
      flagged: moderationResult.shouldFlag,
      issues: moderationResult.issues || [],
      severity: moderationResult.severity || 0,
    },
  });
});

// @desc    Update feedback
// @route   PUT /api/feedback/:id
// @access  Private
export const updateFeedback = asyncHandler(async (req, res) => {
  const feedback = await Feedback.findById(req.params.id);

  if (!feedback) {
    return res.status(404).json({
      success: false,
      message: 'Feedback not found',
    });
  }

  // Check if user can edit this feedback
  if (feedback.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to edit this feedback',
    });
  }

  const {
    title,
    description,
    category,
    priority,
    type,
    tags,
    status,
    assignedTo
  } = req.body;

  // Only admins can change status and assignment
  if (req.user.role !== 'admin') {
    delete req.body.status;
    delete req.body.assignedTo;
  }

  // Content moderation for description changes
  if (description && description !== feedback.description) {
    const moderationResult = moderateContent(description, {
      strictMode: false,
      contextAware: true
    });

    if (moderationResult.shouldBlock) {
      return res.status(400).json({
        success: false,
        message: 'Content violates community guidelines',
        moderation: {
          flagged: true,
          issues: moderationResult.issues || [],
          severity: moderationResult.severity || 0,
        },
      });
    }
  }

  // Update feedback
  const updatedFeedback = await Feedback.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('author', 'name username avatar');

  res.status(200).json({
    success: true,
    message: 'Feedback updated successfully',
    data: updatedFeedback,
  });
});

// @desc    Delete feedback
// @route   DELETE /api/feedback/:id
// @access  Private
export const deleteFeedback = asyncHandler(async (req, res) => {
  const feedback = await Feedback.findById(req.params.id);

  if (!feedback) {
    return res.status(404).json({
      success: false,
      message: 'Feedback not found',
    });
  }

  // Check if user can delete this feedback
  if (feedback.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this feedback',
    });
  }

  await Feedback.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Feedback deleted successfully',
  });
});

// @desc    Add response to feedback
// @route   POST /api/feedback/:id/responses
// @access  Private
export const addResponse = asyncHandler(async (req, res) => {
  const { content, attachments } = req.body;

  const feedback = await Feedback.findById(req.params.id);

  if (!feedback) {
    return res.status(404).json({
      success: false,
      message: 'Feedback not found',
    });
  }

  // Content moderation
  const moderationResult = moderateContent(content, {
    strictMode: false,
    contextAware: true
  });

  if (moderationResult.shouldBlock) {
    return res.status(400).json({
      success: false,
      message: 'Response violates community guidelines',
      moderation: {
        flagged: true,
        issues: moderationResult.issues || [],
        severity: moderationResult.severity || 0,
      },
    });
  }

  const responseData = {
    content,
    author: req.user._id,
    isOfficial: req.user.role === 'admin' || req.user.role === 'moderator',
    attachments: attachments || []
  };

  await feedback.addResponse(responseData);

  // Award points for responding
  await req.user.addPoints(3, `Responded to feedback: ${feedback.title}`);

  // Send notification to feedback author
  if (feedback.author.toString() !== req.user._id.toString()) {
    await Notification.create({
      recipient: feedback.author,
      sender: req.user._id,
      type: 'feedback_response',
      title: 'New Response to Your Feedback',
      message: `${req.user.name} responded to your feedback: ${feedback.title}`,
      priority: 'normal',
      metadata: {
        feedbackId: feedback._id,
        responseId: feedback.responses[feedback.responses.length - 1]._id
      }
    });
  }

  // Populate the new response for return
  const populatedFeedback = await Feedback.findById(req.params.id)
    .populate('responses.author', 'name username avatar role');

  const newResponse = populatedFeedback.responses[populatedFeedback.responses.length - 1];

  res.status(201).json({
    success: true,
    message: 'Response added successfully',
    data: newResponse,
    moderation: {
      flagged: moderationResult.shouldFlag,
      issues: moderationResult.issues || [],
      severity: moderationResult.severity || 0,
    },
  });
});

// @desc    Toggle bookmark on feedback
// @route   POST /api/feedback/:id/bookmark
// @access  Private
// Bookmarking is centralized in Bookmark controller (/api/bookmarks)

// @desc    Toggle flag on feedback
// @route   POST /api/feedback/:id/flag
// @access  Private
export const toggleFlag = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const feedback = await Feedback.findById(req.params.id);

  if (!feedback) {
    return res.status(404).json({
      success: false,
      message: 'Feedback not found',
    });
  }

  await feedback.toggleFlag(req.user._id, reason);

  const isFlagged = feedback.flaggedBy.some(
    flag => flag.user.toString() === req.user._id.toString()
  );

  // Send notification to admins if flagged
  if (isFlagged) {
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await Notification.create({
        recipient: admin._id,
        sender: req.user._id,
        type: 'feedback_flagged',
        title: 'Feedback Flagged',
        message: `Feedback "${feedback.title}" was flagged by ${req.user.name}`,
        priority: 'medium',
        metadata: {
          feedbackId: feedback._id,
          reason: reason || 'No reason provided'
        }
      });
    }
  }

  res.status(200).json({
    success: true,
    message: isFlagged ? 'Feedback flagged' : 'Flag removed',
    data: { isFlagged }
  });
});

// @desc    Toggle bookmark for feedback
// @route   POST /api/feedback/:id/bookmark
// @access  Private
export const toggleBookmark = asyncHandler(async (req, res) => {
  const feedback = await Feedback.findById(req.params.id);

  if (!feedback) {
    return res.status(404).json({
      success: false,
      message: 'Feedback not found'
    });
  }

  const result = await feedback.toggleBookmark(req.user._id);

  res.status(200).json({
    success: true,
    data: result
  });
});

// @desc    Get feedback statistics
// @route   GET /api/feedback/stats/overview
// @access  Private
export const getFeedbackStats = asyncHandler(async (req, res) => {
  const stats = await Feedback.getFeedbackStats();

  res.status(200).json({
    success: true,
    data: stats,
  });
});

// @desc    Get user's feedback
// @route   GET /api/feedback/user/:userId
// @access  Private
export const getUserFeedback = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const userId = req.params.userId;

  // Check if user can view this feedback
  if (userId !== req.params.userId && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this user\'s feedback',
    });
  }

  const feedback = await Feedback.find({ author: userId })
    .populate('author', 'name username avatar')
    .populate('assignedTo', 'name username avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Add user-specific data
  const feedbackWithUserData = feedback.map(item => ({
    ...item,
    isUserAuthor: item.author._id.toString() === req.user._id.toString(),
    isUserBookmarked: item.bookmarkedBy?.some(
      bookmark => bookmark.user.toString() === req.user._id.toString()
    ) || false,
    isUserFlagged: item.flaggedBy?.some(
      flag => flag.user._id.toString() === req.user._id.toString()
    ) || false,
    responseCount: item.responses?.length || 0
  }));

  const total = await Feedback.countDocuments({ author: userId });

  res.status(200).json({
    success: true,
    data: feedbackWithUserData,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Get user's bookmarked feedback
// @route   GET /api/feedback/bookmarks
// @access  Private
export const getUserBookmarks = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const feedback = await Feedback.find({
    'bookmarkedBy.user': req.user._id
  })
    .populate('author', 'name username avatar')
    .populate('assignedTo', 'name username avatar')
    .populate('responses.author', 'name username avatar role')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Add user-specific data
  const feedbackWithUserData = feedback.map(item => ({
    ...item,
    isUserAuthor: item.author._id.toString() === req.user._id.toString(),
    isUserBookmarked: true, // Since we're querying bookmarked items
    isUserFlagged: item.flaggedBy?.some(
      flag => flag.user._id.toString() === req.user._id.toString()
    ) || false,
    responseCount: item.responses?.length || 0
  }));

  const total = await Feedback.countDocuments({
    'bookmarkedBy.user': req.user._id
  });

  res.status(200).json({
    success: true,
    data: feedbackWithUserData,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Get feedback by category with bookmark status
// @route   GET /api/feedback/category/:category
// @access  Private
export const getFeedbackByCategory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const { category } = req.params;

  const query = { category };

  // Add moderation filter for non-admin users
  if (req.user.role !== 'admin') {
    query['moderationStatus.isApproved'] = true;
  }

  const feedback = await Feedback.find(query)
    .populate('author', 'name username avatar')
    .populate('assignedTo', 'name username avatar')
    .populate('responses.author', 'name username avatar role')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Add user-specific data
  const feedbackWithUserData = feedback.map(item => ({
    ...item,
    isUserAuthor: item.author._id.toString() === req.user._id.toString(),
    isUserBookmarked: item.bookmarkedBy?.some(
      bookmark => bookmark.user.toString() === req.user._id.toString()
    ) || false,
    isUserFlagged: item.flaggedBy?.some(
      flag => flag.user._id.toString() === req.user._id.toString()
    ) || false,
    responseCount: item.responses?.length || 0
  }));

  const total = await Feedback.countDocuments(query);

  res.status(200).json({
    success: true,
    data: feedbackWithUserData,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Get user's feedback statistics
// @route   GET /api/feedback/stats/user
// @access  Private
export const getUserFeedbackStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [
    totalSubmitted,
    totalBookmarked,
    totalFlagged,
    totalResponses,
    categoryStats,
    statusStats
  ] = await Promise.all([
    Feedback.countDocuments({ author: userId }),
    Feedback.countDocuments({ 'bookmarkedBy.user': userId }),
    Feedback.countDocuments({ 'flaggedBy.user': userId }),
    Feedback.aggregate([
      { $match: { author: userId } },
      { $group: { _id: null, totalResponses: { $sum: { $size: '$responses' } } } }
    ]),
    Feedback.aggregate([
      { $match: { author: userId } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Feedback.aggregate([
      { $match: { author: userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  ]);

  const totalResponsesCount = totalResponses[0]?.totalResponses || 0;

  res.status(200).json({
    success: true,
    data: {
      totalSubmitted,
      totalBookmarked,
      totalFlagged,
      totalResponses: totalResponsesCount,
      categoryStats,
      statusStats
    },
  });
});

// @desc    Search feedback with bookmark status
// @route   GET /api/feedback/search
// @access  Private
export const searchFeedback = asyncHandler(async (req, res) => {
  const { q: searchQuery, page = 1, limit = 20, category, status, priority, type } = req.query;

  if (!searchQuery) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required',
    });
  }

  const query = {
    $or: [
      { title: { $regex: searchQuery, $options: 'i' } },
      { description: { $regex: searchQuery, $options: 'i' } },
      { tags: { $in: [new RegExp(searchQuery, 'i')] } }
    ]
  };

  // Add filters
  if (category && category !== 'all') query.category = category;
  if (status && status !== 'all') query.status = status;
  if (priority && priority !== 'all') query.priority = priority;
  if (type && type !== 'all') query.type = type;

  // Add moderation filter for non-admin users
  if (req.user.role !== 'admin') {
    query['moderationStatus.isApproved'] = true;
  }

  const feedback = await Feedback.find(query)
    .populate('author', 'name username avatar')
    .populate('assignedTo', 'name username avatar')
    .populate('responses.author', 'name username avatar role')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Add user-specific data
  const feedbackWithUserData = feedback.map(item => ({
    ...item,
    isUserAuthor: item.author._id.toString() === req.user._id.toString(),
    isUserBookmarked: item.bookmarkedBy?.some(
      bookmark => bookmark.user.toString() === req.user._id.toString()
    ) || false,
    isUserFlagged: item.flaggedBy?.some(
      flag => flag.user._id.toString() === req.user._id.toString()
    ) || false,
    responseCount: item.responses?.length || 0
  }));

  const total = await Feedback.countDocuments(query);

  res.status(200).json({
    success: true,
    data: feedbackWithUserData,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Get popular/top bookmarked feedback
// @route   GET /api/feedback/popular
// @access  Private
export const getPopularFeedback = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, timeframe = 'all' } = req.query;

  let dateFilter = {};
  if (timeframe !== 'all') {
    const now = new Date();
    switch (timeframe) {
      case 'week':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case 'month':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } };
        break;
      case 'year':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) } };
        break;
    }
  }

  const query = { ...dateFilter };

  // Add moderation filter for non-admin users
  if (req.user.role !== 'admin') {
    query['moderationStatus.isApproved'] = true;
  }

  const feedback = await Feedback.aggregate([
    { $match: query },
    {
      $addFields: {
        bookmarkCount: { $size: '$bookmarkedBy' },
        responseCount: { $size: '$responses' },
        engagementScore: {
          $add: [
            { $multiply: [{ $size: '$bookmarkedBy' }, 2] },
            { $size: '$responses' },
            { $multiply: ['$views', 0.1] }
          ]
        }
      }
    },
    { $sort: { engagementScore: -1, createdAt: -1 } },
    { $skip: (parseInt(page) - 1) * parseInt(limit) },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: 'users',
        localField: 'author',
        foreignField: '_id',
        as: 'author'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'assignedTo',
        foreignField: '_id',
        as: 'assignedTo'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'responses.author',
        foreignField: '_id',
        as: 'responses.author'
      }
    },
    { $unwind: '$author' },
    {
      $addFields: {
        'assignedTo': { $arrayElemAt: ['$assignedTo', 0] }
      }
    }
  ]);

  // Add user-specific data
  const feedbackWithUserData = feedback.map(item => ({
    ...item,
    isUserAuthor: item.author._id.toString() === req.user._id.toString(),
    isUserBookmarked: item.bookmarkedBy?.some(
      bookmark => bookmark.user.toString() === req.user._id.toString()
    ) || false,
    isUserFlagged: item.flaggedBy?.some(
      flag => flag.user._id.toString() === req.user._id.toString()
    ) || false,
    responseCount: item.responses?.length || 0
  }));

  const total = await Feedback.countDocuments(query);

  res.status(200).json({
    success: true,
    data: feedbackWithUserData,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// Admin functions

// @desc    Moderate feedback
// @route   PUT /api/feedback/:id/moderate
// @access  Private (Admin)
export const moderateFeedback = asyncHandler(async (req, res) => {
  const { action, notes } = req.body;

  const feedback = await Feedback.findById(req.params.id);

  if (!feedback) {
    return res.status(404).json({
      success: false,
      message: 'Feedback not found',
    });
  }

  switch (action) {
    case 'approve':
      feedback.moderationStatus.isApproved = true;
      feedback.moderationStatus.moderatedBy = req.user._id;
      feedback.moderationStatus.moderatedAt = new Date();
      feedback.moderationStatus.moderationNotes = notes;
      break;
    case 'reject':
      feedback.moderationStatus.isApproved = false;
      feedback.moderationStatus.moderatedBy = req.user._id;
      feedback.moderationStatus.moderatedAt = new Date();
      feedback.moderationStatus.moderationNotes = notes;
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'Invalid moderation action',
      });
  }

  await feedback.save();

  // Send notification to feedback author
  await Notification.create({
    recipient: feedback.author,
    sender: req.user._id,
    type: 'feedback_moderated',
    title: `Feedback ${action === 'approve' ? 'Approved' : 'Rejected'}`,
    message: `Your feedback "${feedback.title}" has been ${action === 'approve' ? 'approved' : 'rejected'}. ${notes ? `Reason: ${notes}` : ''}`,
    priority: 'normal',
    metadata: {
      feedbackId: feedback._id,
      action,
      notes
    }
  });

  res.status(200).json({
    success: true,
    message: `Feedback ${action}ed successfully`,
    data: feedback,
  });
});

// @desc    Assign feedback to user
// @route   PUT /api/feedback/:id/assign
// @access  Private (Admin)
export const assignFeedback = asyncHandler(async (req, res) => {
  const { assignedTo } = req.body;

  const feedback = await Feedback.findById(req.params.id);

  if (!feedback) {
    return res.status(404).json({
      success: false,
      message: 'Feedback not found',
    });
  }

  // Verify assigned user exists
  const assignedUser = await User.findById(assignedTo);
  if (!assignedUser) {
    return res.status(404).json({
      success: false,
      message: 'Assigned user not found',
    });
  }

  feedback.assignedTo = assignedTo;
  feedback.updatedAt = new Date();

  await feedback.save();

  // Send notification to assigned user
  await Notification.create({
    recipient: assignedTo,
    sender: req.user._id,
    type: 'feedback_assigned',
    title: 'Feedback Assigned to You',
    message: `You have been assigned to handle feedback: ${feedback.title}`,
    priority: 'high',
    metadata: {
      feedbackId: feedback._id,
      assignedBy: req.user._id
    }
  });

  res.status(200).json({
    success: true,
    message: 'Feedback assigned successfully',
    data: feedback,
  });
});

// @desc    Bulk moderate feedback
// @route   PUT /api/feedback/bulk/moderate
// @access  Private (Admin)
export const bulkModerateFeedback = asyncHandler(async (req, res) => {
  const { feedbackIds, action, notes } = req.body;

  if (!Array.isArray(feedbackIds) || feedbackIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Feedback IDs array is required',
    });
  }

  if (feedbackIds.length > 50) {
    return res.status(400).json({
      success: false,
      message: 'Maximum 50 feedback items can be processed at once',
    });
  }

  const results = [];
  const failedItems = [];

  for (const feedbackId of feedbackIds) {
    try {
      const feedback = await Feedback.findById(feedbackId);

      if (!feedback) {
        failedItems.push({ feedbackId, error: 'Feedback not found' });
        continue;
      }

      switch (action) {
        case 'approve':
          feedback.moderationStatus.isApproved = true;
          break;
        case 'reject':
          feedback.moderationStatus.isApproved = false;
          break;
        case 'delete':
          await Feedback.findByIdAndDelete(feedbackId);
          results.push({ feedbackId, action: 'deleted' });
          continue;
        default:
          failedItems.push({ feedbackId, error: 'Invalid action' });
          continue;
      }

      feedback.moderationStatus.moderatedBy = req.user._id;
      feedback.moderationStatus.moderatedAt = new Date();
      feedback.moderationStatus.moderationNotes = notes;

      await feedback.save();
      results.push({ feedbackId, action });

    } catch (error) {
      failedItems.push({ feedbackId, error: error.message });
    }
  }

  res.status(200).json({
    success: true,
    message: `Processed ${results.length} feedback items: ${results.filter(r => r.action === 'deleted').length} deleted, ${results.filter(r => r.action !== 'deleted').length} moderated`,
    data: {
      successful: results,
      failed: failedItems,
      summary: {
        total: feedbackIds.length,
        successful: results.length,
        failed: failedItems.length
      }
    },
  });
});

export default {
  getFeedback,
  getFeedbackById,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  addResponse,
  toggleFlag,
  toggleBookmark,
  getFeedbackStats,
  getUserFeedback,
  getUserBookmarks,
  getFeedbackByCategory,
  getUserFeedbackStats,
  searchFeedback,
  getPopularFeedback,
  moderateFeedback,
  assignFeedback,
  bulkModerateFeedback
};
