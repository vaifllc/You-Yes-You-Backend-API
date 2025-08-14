import Report from '../models/Report.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { Message } from '../models/Message.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { moderateContent, analyzeUserBehavior, getModerationStats } from '../utils/moderationUtils.js';

// @desc    Report content
// @route   POST /api/moderation/report
// @access  Private
export const reportContent = asyncHandler(async (req, res) => {
  const { contentType, contentId, reason, description, reportedUserId } = req.body;

  // Validate content exists
  let content;
  switch (contentType) {
    case 'post':
      content = await Post.findById(contentId);
      break;
    case 'message':
      content = await Message.findById(contentId);
      break;
    case 'user':
      content = await User.findById(contentId);
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'Invalid content type',
      });
  }

  if (!content) {
    return res.status(404).json({
      success: false,
      message: 'Content not found',
    });
  }

  // Check if user already reported this content
  const existingReport = await Report.findOne({
    reporter: req.user._id,
    contentType,
    contentId,
  });

  if (existingReport) {
    return res.status(400).json({
      success: false,
      message: 'You have already reported this content',
    });
  }

  // Create report
  const report = await Report.create({
    reporter: req.user._id,
    reportedUser: reportedUserId || (content.author || content._id),
    contentType,
    contentId,
    reason,
    description,
    priority: reason === 'hate_speech' || reason === 'violence' ? 'high' : 'medium',
  });

  await report.populate('reporter', 'name username');

  res.status(201).json({
    success: true,
    message: 'Content reported successfully. Our moderation team will review it.',
    data: report,
  });
});

// @desc    Get moderation dashboard
// @route   GET /api/moderation/dashboard
// @access  Private (Admin)
export const getModerationDashboard = asyncHandler(async (req, res) => {
  const stats = await getModerationStats(Post, Report, User);

  // Get recent reports
  const recentReports = await Report.find()
    .populate('reporter', 'name username avatar')
    .populate('reportedUser', 'name username avatar')
    .sort({ createdAt: -1 })
    .limit(10);

  // Get high priority reports
  const highPriorityReports = await Report.find({ 
    status: 'pending',
    priority: { $in: ['high', 'urgent'] },
  })
    .populate('reporter reportedUser', 'name username avatar')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      stats,
      recentReports,
      highPriorityReports,
    },
  });
});

// @desc    Get all reports
// @route   GET /api/moderation/reports
// @access  Private (Admin)
export const getReports = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    status = 'all',
    priority,
    contentType,
    reason,
  } = req.query;

  const query = {};
  
  if (status !== 'all') {
    query.status = status;
  }
  
  if (priority && priority !== 'all') {
    query.priority = priority;
  }
  
  if (contentType && contentType !== 'all') {
    query.contentType = contentType;
  }
  
  if (reason && reason !== 'all') {
    query.reason = reason;
  }

  const reports = await Report.find(query)
    .populate('reporter', 'name username avatar')
    .populate('reportedUser', 'name username avatar')
    .populate('resolution.resolvedBy', 'name username')
    .sort({ priority: -1, createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Report.countDocuments(query);

  res.status(200).json({
    success: true,
    data: reports,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Handle report
// @route   PUT /api/moderation/reports/:id
// @access  Private (Admin)
export const handleReport = asyncHandler(async (req, res) => {
  const { action, reason, notes } = req.body;

  const validActions = [
    'dismiss',
    'warn_user',
    'remove_content',
    'suspend_user',
    'ban_user',
    'escalate',
  ];

  if (!validActions.includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid action',
    });
  }

  const report = await Report.findById(req.params.id)
    .populate('reportedUser');

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Report not found',
    });
  }

  // Add moderator action
  report.moderatorActions.push({
    moderator: req.user._id,
    action,
    reason,
    notes,
  });

  // Handle different actions
  switch (action) {
    case 'dismiss':
      report.status = 'dismissed';
      await report.resolve(req.user._id, 'Report dismissed', reason);
      break;

    case 'warn_user':
      if (report.reportedUser) {
        report.reportedUser.warnings = report.reportedUser.warnings || [];
        report.reportedUser.warnings.push({
          type: 'warning',
          reason,
          issuedBy: req.user._id,
          issuedAt: new Date(),
        });
        await report.reportedUser.save();
      }
      report.status = 'resolved';
      await report.resolve(req.user._id, 'User warned', reason);
      break;

    case 'remove_content':
      // Remove the reported content
      if (report.contentType === 'post') {
        await Post.findByIdAndUpdate(report.contentId, { isApproved: false });
      } else if (report.contentType === 'message') {
        await Message.findByIdAndUpdate(report.contentId, { 
          isDeleted: true,
          deletedAt: new Date(),
        });
      }
      report.status = 'resolved';
      await report.resolve(req.user._id, 'Content removed', reason);
      break;

    case 'suspend_user':
      if (report.reportedUser) {
        report.reportedUser.warnings = report.reportedUser.warnings || [];
        report.reportedUser.warnings.push({
          type: 'suspension',
          reason,
          issuedBy: req.user._id,
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });
        await report.reportedUser.save();
      }
      report.status = 'resolved';
      await report.resolve(req.user._id, 'User suspended', reason);
      break;

    case 'ban_user':
      if (report.reportedUser) {
        report.reportedUser.warnings = report.reportedUser.warnings || [];
        report.reportedUser.warnings.push({
          type: 'banned',
          reason,
          issuedBy: req.user._id,
          issuedAt: new Date(),
        });
        await report.reportedUser.save();
      }
      report.status = 'resolved';
      await report.resolve(req.user._id, 'User banned', reason);
      break;

    case 'escalate':
      await report.escalate(req.user._id, reason);
      break;
  }

  res.status(200).json({
    success: true,
    message: 'Report handled successfully',
    data: report,
  });
});

// @desc    Analyze user behavior
// @route   GET /api/moderation/analyze/:userId
// @access  Private (Admin)
export const analyzeUser = asyncHandler(async (req, res) => {
  const analysis = await analyzeUserBehavior(
    req.params.userId,
    User,
    Post,
    Report
  );

  if (!analysis) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  res.status(200).json({
    success: true,
    data: analysis,
  });
});

// @desc    Bulk moderate content
// @route   PUT /api/moderation/bulk
// @access  Private (Admin)
export const bulkModerate = asyncHandler(async (req, res) => {
  const { reportIds, action, reason } = req.body;

  if (!Array.isArray(reportIds) || reportIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Report IDs array is required',
    });
  }

  const results = [];

  for (const reportId of reportIds) {
    try {
      const report = await Report.findById(reportId);
      if (report) {
        report.moderatorActions.push({
          moderator: req.user._id,
          action,
          reason,
        });

        if (action === 'dismiss') {
          report.status = 'dismissed';
        } else {
          report.status = 'resolved';
        }

        await report.save();
        results.push({ reportId, success: true });
      }
    } catch (error) {
      results.push({ reportId, success: false, error: error.message });
    }
  }

  res.status(200).json({
    success: true,
    message: `Processed ${results.length} reports`,
    data: results,
  });
});

// @desc    Get content moderation stats
// @route   GET /api/moderation/stats
// @access  Private (Admin)
export const getModerationStatistics = asyncHandler(async (req, res) => {
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
    reportsByReason,
    reportsByStatus,
    reportsByPriority,
    moderationActions,
  ] = await Promise.all([
    Report.aggregate([
      { $match: { createdAt: dateFilter } },
      { $group: { _id: '$reason', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Report.aggregate([
      { $match: { createdAt: dateFilter } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Report.aggregate([
      { $match: { createdAt: dateFilter } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    Report.aggregate([
      { $match: { createdAt: dateFilter } },
      { $unwind: '$moderatorActions' },
      { $group: { _id: '$moderatorActions.action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      timeframe,
      reportsByReason,
      reportsByStatus,
      reportsByPriority,
      moderationActions,
    },
  });
});