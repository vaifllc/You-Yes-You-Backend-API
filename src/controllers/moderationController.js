import Report from '../models/Report.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { Message } from '../models/Message.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  moderateContent,
  analyzeUserBehavior,
  getModerationStats,
  moderateContentBatch,
  filterPersonalInfo
} from '../utils/moderationUtils.js';

// Helper function to convert severity string to number
function getSeverityNumber(severity) {
  switch (severity) {
    case 'low': return 2;
    case 'medium': return 5;
    case 'high': return 8;
    case 'critical': return 10;
    default: return 5; // Default to medium
  }
}

// @desc    Report content with enhanced validation
// @route   POST /api/moderation/report
// @access  Private
export const reportContent = asyncHandler(async (req, res) => {
  const { contentType, contentId, reason, description, reportedUserId, severity } = req.body;

  // Enhanced validation for report reasons
  const validReasons = [
    'hate_speech',
    'violence',
    'harassment',
    'spam',
    'inappropriate_content',
    'personal_information',
    'copyright',
    'misinformation',
    'self_harm',
    'illegal_activity',
    'other'
  ];

  if (!validReasons.includes(reason)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid report reason',
      validReasons
    });
  }

  // Validate content exists and get detailed info
  let content, reportedUser;
  try {
    switch (contentType) {
      case 'post':
        content = await Post.findById(contentId).populate('author', 'name username email');
        reportedUser = content?.author;
        break;
      case 'comment':
        // For comments, we need to find the post and the specific comment
        const postWithComment = await Post.findOne(
          { 'comments._id': contentId },
          { 'comments.$': 1, author: 1 }
        ).populate('comments.user', 'name username email');

        if (postWithComment && postWithComment.comments.length > 0) {
          content = postWithComment.comments[0]; // The matched comment
          reportedUser = content.user;
        }
        break;
      case 'message':
        content = await Message.findById(contentId).populate('sender', 'name username email');
        reportedUser = content?.sender;
        break;
      case 'user':
        content = await User.findById(contentId);
        reportedUser = content;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid content type. Must be: post, comment, message, or user',
        });
    }
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid content ID format',
    });
  }

  if (!content) {
    return res.status(404).json({
      success: false,
      message: 'Content not found',
    });
  }

  // Prevent self-reporting
  if (reportedUser && reportedUser._id.toString() === req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'You cannot report your own content',
    });
  }

  // Check if user already reported this content
  const existingReport = await Report.findOne({
    reporter: req.user._id,
    contentType,
    contentId,
    status: { $nin: ['dismissed', 'invalid'] }
  });

  if (existingReport) {
    return res.status(400).json({
      success: false,
      message: 'You have already reported this content',
    });
  }

  // Check for spam reporting (too many reports in short time)
  const recentReports = await Report.countDocuments({
    reporter: req.user._id,
    createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
  });

  if (recentReports >= 10) {
    return res.status(429).json({
      success: false,
      message: 'Too many reports in the last hour. Please wait before reporting again.',
    });
  }

  // Auto-moderate the content being reported
  let moderationResult = null;
  if (contentType !== 'user' && content.content) {
    moderationResult = moderateContent(content.content, {
      strictMode: true,
      contextAware: true
    });
  }

  // Determine priority based on reason, severity, and auto-moderation
  let priority = 'medium';
  const highPriorityReasons = ['hate_speech', 'violence', 'self_harm', 'illegal_activity'];
  const urgentReasons = ['violence', 'self_harm'];

  if (urgentReasons.includes(reason)) {
    priority = 'urgent';
  } else if (highPriorityReasons.includes(reason) || severity === 'high') {
    priority = 'high';
  } else if (moderationResult?.shouldBlock) {
    priority = 'high';
  } else if (moderationResult?.shouldFlag) {
    priority = 'medium';
  }

  // Create enhanced report
  const report = await Report.create({
    reporter: req.user._id,
    reportedUser: reportedUserId || reportedUser?._id,
    contentType,
    contentId,
    reason,
    description: filterPersonalInfo(description || ''), // Remove any personal info from description
    priority,
    severity: getSeverityNumber(severity || 'medium'),
    metadata: {
      reporterIP: req.ip,
      userAgent: req.get('User-Agent'),
      moderationResult: moderationResult ? {
        severity: moderationResult.severity,
        flags: moderationResult.flags,
        confidence: moderationResult.confidence
      } : null,
      contentSnapshot: contentType !== 'user' ? {
        content: content.content || content.message || '',
        createdAt: content.createdAt,
        metadata: content.metadata
      } : null
    }
  });

  await report.populate([
    { path: 'reporter', select: 'name username avatar' },
    { path: 'reportedUser', select: 'name username avatar' }
  ]);

  // Auto-escalate high confidence violations
  if (moderationResult?.confidence > 85 && moderationResult?.shouldBlock) {
    await report.escalate(null, 'Auto-escalated due to high confidence violation detection');
  }

  res.status(201).json({
    success: true,
    message: 'Content reported successfully. Our moderation team will review it.',
    data: {
      report,
      estimatedReviewTime: priority === 'urgent' ? '< 1 hour' :
                          priority === 'high' ? '< 24 hours' : '< 72 hours'
    },
  });
});

// @desc    Get enhanced moderation dashboard
// @route   GET /api/moderation/dashboard
// @access  Private (Admin)
export const getModerationDashboard = asyncHandler(async (req, res) => {
  const stats = await getModerationStats(Post, Report, User);

  // Get recent reports with enhanced data
  const recentReports = await Report.find()
    .populate('reporter', 'name username avatar')
    .populate('reportedUser', 'name username avatar moderationStatus')
    .sort({ createdAt: -1 })
    .limit(15);

  // Get high priority reports
  const highPriorityReports = await Report.find({
    status: 'pending',
    priority: { $in: ['high', 'urgent'] },
  })
    .populate('reporter reportedUser', 'name username avatar moderationStatus')
    .sort({ priority: -1, createdAt: -1 })
    .limit(20);

  // Get escalated reports
  const escalatedReports = await Report.find({
    status: 'escalated',
    isEscalated: true
  })
    .populate('reporter reportedUser', 'name username avatar')
    .sort({ escalatedAt: -1 })
    .limit(10);

  // Get auto-moderation statistics
  const autoModerationStats = await getAutoModerationStats();

  // Get moderator performance metrics
  const moderatorStats = await getModeratorPerformanceStats();

  res.status(200).json({
    success: true,
    data: {
      overview: stats,
      recentReports,
      highPriorityReports,
      escalatedReports,
      autoModerationStats,
      moderatorStats,
      alerts: await generateModerationAlerts()
    },
  });
});

// @desc    Get all reports with enhanced filtering
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
    severity,
    dateFrom,
    dateTo,
    reportedUser,
    autoModerated,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const query = {};

  // Build enhanced query filters
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

  if (severity && severity !== 'all') {
    query.severity = severity;
  }

  if (reportedUser) {
    query.reportedUser = reportedUser;
  }

  if (autoModerated !== undefined) {
    query['metadata.moderationResult'] = autoModerated === 'true' ? { $ne: null } : null;
  }

  // Date range filtering
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  // Build sort object
  const sortObj = {};
  const validSortFields = ['createdAt', 'priority', 'status', 'severity'];
  if (validSortFields.includes(sortBy)) {
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
  } else {
    sortObj.createdAt = -1;
  }

  // Add priority sorting as secondary
  if (sortBy !== 'priority') {
    sortObj.priority = -1;
  }

  const reports = await Report.find(query)
    .populate('reporter', 'name username avatar')
    .populate('reportedUser', 'name username avatar moderationStatus')
    .populate('resolution.resolvedBy', 'name username')
    .populate('escalation.escalatedBy', 'name username')
    .sort(sortObj)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Report.countDocuments(query);

  // Get filter options for frontend
  const filterOptions = await getReportFilterOptions();

  res.status(200).json({
    success: true,
    data: reports,
    filterOptions,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Handle report with enhanced actions
// @route   PUT /api/moderation/reports/:id
// @access  Private (Admin)
export const handleReport = asyncHandler(async (req, res) => {
  const { action, reason, notes, severity, duration, customAction } = req.body;

  const validActions = [
    'dismiss',
    'warn_user',
    'remove_content',
    'suspend_user',
    'ban_user',
    'shadow_ban',
    'restrict_posting',
    'require_approval',
    'escalate',
    'mark_spam',
    'educational_intervention',
    'custom'
  ];

  if (!validActions.includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid action',
      validActions
    });
  }

  const report = await Report.findById(req.params.id)
    .populate('reportedUser')
    .populate('reporter', 'name username');

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Report not found',
    });
  }

  if (report.status === 'resolved' || report.status === 'dismissed') {
    return res.status(400).json({
      success: false,
      message: 'Report has already been handled',
    });
  }

  // Add moderator action with enhanced tracking
  const moderatorAction = {
    moderator: req.user._id,
    action,
    reason,
    notes,
    severity: severity || 'medium',
    duration: duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null,
    customAction,
    timestamp: new Date()
  };

  report.moderatorActions.push(moderatorAction);

  // Handle different actions with enhanced logic
  switch (action) {
    case 'dismiss':
      report.status = 'dismissed';
      await report.resolve(req.user._id, 'Report dismissed', reason);
      break;

    case 'warn_user':
      await handleUserWarning(report.reportedUser, req.user._id, reason, severity);
      report.status = 'resolved';
      await report.resolve(req.user._id, 'User warned', reason);
      break;

    case 'remove_content':
      await handleContentRemoval(report, req.user._id, reason);
      report.status = 'resolved';
      await report.resolve(req.user._id, 'Content removed', reason);
      break;

    case 'suspend_user':
      await handleUserSuspension(report.reportedUser, req.user._id, reason, duration || 7);
      report.status = 'resolved';
      await report.resolve(req.user._id, 'User suspended', reason);
      break;

    case 'ban_user':
      await handleUserBan(report.reportedUser, req.user._id, reason);
      report.status = 'resolved';
      await report.resolve(req.user._id, 'User banned', reason);
      break;

    case 'shadow_ban':
      await handleShadowBan(report.reportedUser, req.user._id, reason, duration || 30);
      report.status = 'resolved';
      await report.resolve(req.user._id, 'User shadow banned', reason);
      break;

    case 'restrict_posting':
      await handlePostingRestriction(report.reportedUser, req.user._id, reason, duration || 7);
      report.status = 'resolved';
      await report.resolve(req.user._id, 'User posting restricted', reason);
      break;

    case 'require_approval':
      await handleApprovalRequirement(report.reportedUser, req.user._id, reason);
      report.status = 'resolved';
      await report.resolve(req.user._id, 'User requires approval', reason);
      break;

    case 'mark_spam':
      await handleSpamMarking(report, req.user._id, reason);
      report.status = 'resolved';
      await report.resolve(req.user._id, 'Marked as spam', reason);
      break;

    case 'educational_intervention':
      await handleEducationalIntervention(report.reportedUser, req.user._id, reason);
      report.status = 'resolved';
      await report.resolve(req.user._id, 'Educational intervention applied', reason);
      break;

    case 'escalate':
      await report.escalate(req.user._id, reason);
      break;

    case 'custom':
      if (!customAction) {
        return res.status(400).json({
          success: false,
          message: 'Custom action description required',
        });
      }
      report.status = 'resolved';
      await report.resolve(req.user._id, customAction, reason);
      break;
  }

  // Update user's moderation history
  if (report.reportedUser) {
    await updateUserModerationHistory(report.reportedUser, moderatorAction);
  }

  await report.save();

  res.status(200).json({
    success: true,
    message: 'Report handled successfully',
    data: await report.populate([
      { path: 'moderatorActions.moderator', select: 'name username' },
      { path: 'reportedUser', select: 'name username moderationStatus' }
    ]),
  });
});

// @desc    Analyze user behavior with enhanced metrics
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

  // Get additional context
  const user = await User.findById(req.params.userId)
    .populate('moderationStatus.warnings.issuedBy', 'name username');

  const recentContent = await getRecentUserContent(req.params.userId);
  const similarUsers = await findSimilarRiskUsers(analysis.riskScore);

  res.status(200).json({
    success: true,
    data: {
      ...analysis,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        moderationStatus: user.moderationStatus,
        lastActive: user.lastActive
      },
      recentContent,
      similarUsers,
      timeline: await generateModerationTimeline(req.params.userId)
    },
  });
});

// @desc    Bulk moderate content with enhanced processing
// @route   PUT /api/moderation/bulk
// @access  Private (Admin)
export const bulkModerate = asyncHandler(async (req, res) => {
  const { reportIds, action, reason, severity, duration } = req.body;

  if (!Array.isArray(reportIds) || reportIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Report IDs array is required',
    });
  }

  if (reportIds.length > 50) {
    return res.status(400).json({
      success: false,
      message: 'Maximum 50 reports can be processed at once',
    });
  }

  const results = [];
  const failedReports = [];
  const successfulReports = [];

  // Process in batches to prevent overwhelming the system
  const batchSize = 10;
  for (let i = 0; i < reportIds.length; i += batchSize) {
    const batch = reportIds.slice(i, i + batchSize);

    const batchPromises = batch.map(async (reportId) => {
      try {
        const report = await Report.findById(reportId).populate('reportedUser');

        if (!report) {
          return { reportId, success: false, error: 'Report not found' };
        }

        if (report.status === 'resolved' || report.status === 'dismissed') {
          return { reportId, success: false, error: 'Report already handled' };
        }

        // Add moderator action
        report.moderatorActions.push({
          moderator: req.user._id,
          action,
          reason,
          severity: severity || 'medium',
          duration: duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null,
          timestamp: new Date(),
          bulkAction: true
        });

        // Apply the action
        switch (action) {
          case 'dismiss':
            report.status = 'dismissed';
            await report.resolve(req.user._id, 'Bulk dismissed', reason);
            break;
          case 'resolve':
            report.status = 'resolved';
            await report.resolve(req.user._id, 'Bulk resolved', reason);
            break;
          case 'escalate':
            await report.escalate(req.user._id, reason);
            break;
          default:
            report.status = 'resolved';
            await report.resolve(req.user._id, `Bulk ${action}`, reason);
        }

        await report.save();
        return { reportId, success: true };

      } catch (error) {
        return { reportId, success: false, error: error.message };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Small delay between batches
    if (i + batchSize < reportIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Categorize results
  results.forEach(result => {
    if (result.success) {
      successfulReports.push(result.reportId);
    } else {
      failedReports.push(result);
    }
  });

  res.status(200).json({
    success: true,
    message: `Processed ${results.length} reports: ${successfulReports.length} successful, ${failedReports.length} failed`,
    data: {
      successful: successfulReports,
      failed: failedReports,
      summary: {
        total: results.length,
        successful: successfulReports.length,
        failed: failedReports.length
      }
    },
  });
});

// @desc    Auto-moderate content
// @route   POST /api/moderation/auto-moderate
// @access  Private (Admin)
export const autoModerate = asyncHandler(async (req, res) => {
  const { contentIds, contentType = 'post', options = {} } = req.body;

  if (!Array.isArray(contentIds) || contentIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Content IDs array is required',
    });
  }

  let contents = [];

  try {
    switch (contentType) {
      case 'post':
        contents = await Post.find({ _id: { $in: contentIds } })
          .populate('author', 'name username');
        break;
      case 'message':
        contents = await Message.find({ _id: { $in: contentIds } })
          .populate('sender', 'name username');
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid content type',
        });
    }
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid content IDs format',
    });
  }

  const contentTexts = contents.map(content => content.content || content.message || '');
  const moderationResults = await moderateContentBatch(contentTexts, {
    strictMode: options.strictMode || false,
    contextAware: options.contextAware !== false,
    personalInfoCheck: options.personalInfoCheck !== false,
    spamCheck: options.spamCheck !== false,
    batchSize: 50
  });

  const results = [];

  for (let i = 0; i < contents.length; i++) {
    const content = contents[i];
    const result = moderationResults[i];

    if (result) {
      // Update content with moderation results
      content.moderationFlags = {
        ...result.flags,
        severity: result.severity,
        confidence: result.confidence,
        lastChecked: new Date()
      };

      // Auto-action based on results
      if (result.shouldBlock) {
        content.isApproved = false;
        content.moderationStatus = 'blocked';
      } else if (result.shouldFlag) {
        content.moderationStatus = 'flagged';
      }

      await content.save();

      results.push({
        contentId: content._id,
        isClean: result.isClean,
        shouldBlock: result.shouldBlock,
        shouldFlag: result.shouldFlag,
        severity: result.severity,
        confidence: result.confidence,
        issues: result.issues
      });
    }
  }

  res.status(200).json({
    success: true,
    message: `Auto-moderated ${results.length} items`,
    data: {
      results,
      summary: {
        total: results.length,
        blocked: results.filter(r => r.shouldBlock).length,
        flagged: results.filter(r => r.shouldFlag).length,
        clean: results.filter(r => r.isClean).length
      }
    }
  });
});

// @desc    Get enhanced moderation statistics
// @route   GET /api/moderation/stats
// @access  Private (Admin)
export const getModerationStatistics = asyncHandler(async (req, res) => {
  const { timeframe = '30d', groupBy = 'day' } = req.query;

  let dateFilter = {};
  const now = new Date();

  switch (timeframe) {
    case '24h':
      dateFilter = { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
      break;
    case '7d':
      dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      break;
    case '30d':
      dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      break;
    case '90d':
      dateFilter = { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
      break;
    case '1y':
      dateFilter = { $gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) };
      break;
  }

  const [
    reportsByReason,
    reportsByStatus,
    reportsByPriority,
    moderationActions,
    responseTimeStats,
    accuracyStats,
    trendData
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
    calculateResponseTimeStats(dateFilter),
    calculateAccuracyStats(dateFilter),
    generateTrendData(dateFilter, groupBy)
  ]);

  // Get auto-moderation effectiveness
  const autoModerationStats = await Report.aggregate([
    { $match: { createdAt: dateFilter, 'metadata.moderationResult': { $ne: null } } },
    {
      $group: {
        _id: null,
        totalAutoModerated: { $sum: 1 },
        highConfidence: {
          $sum: { $cond: [{ $gte: ['$metadata.moderationResult.confidence', 80] }, 1, 0] }
        },
        autoBlocked: {
          $sum: { $cond: ['$metadata.moderationResult.shouldBlock', 1, 0] }
        }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      timeframe,
      overview: {
        reportsByReason,
        reportsByStatus,
        reportsByPriority,
        moderationActions
      },
      performance: {
        responseTime: responseTimeStats[0] || {},
        accuracy: accuracyStats[0] || {},
        autoModeration: autoModerationStats[0] || {}
      },
      trends: trendData
    },
  });
});

// Helper functions
const handleUserWarning = async (user, moderatorId, reason, severity) => {
  if (!user) return;

  if (!user.moderationStatus) {
    user.moderationStatus = { warnings: [], warningCount: 0 };
  }

  user.moderationStatus.warnings.push({
    type: 'warning',
    reason,
    severity: severity || 'medium',
    issuedBy: moderatorId,
    issuedAt: new Date(),
  });

  user.moderationStatus.warningCount = (user.moderationStatus.warningCount || 0) + 1;
  await user.save();
};

const handleContentRemoval = async (report, moderatorId, reason) => {
  switch (report.contentType) {
    case 'post':
      await Post.findByIdAndUpdate(report.contentId, {
        isApproved: false,
        moderationStatus: 'removed',
        removedAt: new Date(),
        removedBy: moderatorId,
        removalReason: reason
      });
      break;
    case 'message':
      await Message.findByIdAndUpdate(report.contentId, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: moderatorId,
        deletionReason: reason
      });
      break;
  }
};

const handleUserSuspension = async (user, moderatorId, reason, duration) => {
  if (!user) return;

  if (!user.moderationStatus) {
    user.moderationStatus = { warnings: [], warningCount: 0 };
  }

  user.moderationStatus.warnings.push({
    type: 'suspension',
    reason,
    issuedBy: moderatorId,
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
    duration: `${duration} days`
  });

  user.moderationStatus.isSuspended = true;
  user.moderationStatus.suspensionExpiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
  await user.save();
};

const handleUserBan = async (user, moderatorId, reason) => {
  if (!user) return;

  if (!user.moderationStatus) {
    user.moderationStatus = { warnings: [], warningCount: 0 };
  }

  user.moderationStatus.warnings.push({
    type: 'ban',
    reason,
    issuedBy: moderatorId,
    issuedAt: new Date(),
  });

  user.moderationStatus.isBanned = true;
  user.moderationStatus.bannedAt = new Date();
  await user.save();
};

const handleShadowBan = async (user, moderatorId, reason, duration) => {
  if (!user) return;

  if (!user.moderationStatus) {
    user.moderationStatus = { warnings: [], warningCount: 0 };
  }

  user.moderationStatus.warnings.push({
    type: 'shadow_ban',
    reason,
    issuedBy: moderatorId,
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
    duration: `${duration} days`
  });

  user.moderationStatus.isShadowBanned = true;
  user.moderationStatus.shadowBanExpiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
  await user.save();
};

const handlePostingRestriction = async (user, moderatorId, reason, duration) => {
  if (!user) return;

  if (!user.moderationStatus) {
    user.moderationStatus = { warnings: [], warningCount: 0 };
  }

  user.moderationStatus.warnings.push({
    type: 'posting_restriction',
    reason,
    issuedBy: moderatorId,
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
    duration: `${duration} days`
  });

  user.moderationStatus.postingRestricted = true;
  user.moderationStatus.postingRestrictionExpiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
  await user.save();
};

const handleApprovalRequirement = async (user, moderatorId, reason) => {
  if (!user) return;

  if (!user.moderationStatus) {
    user.moderationStatus = { warnings: [], warningCount: 0 };
  }

  user.moderationStatus.warnings.push({
    type: 'approval_required',
    reason,
    issuedBy: moderatorId,
    issuedAt: new Date(),
  });

  user.moderationStatus.requiresApproval = true;
  await user.save();
};

const handleSpamMarking = async (report, moderatorId, reason) => {
  // Mark content as spam
  await handleContentRemoval(report, moderatorId, reason);

  // Update user's spam score
  if (report.reportedUser) {
    if (!report.reportedUser.moderationStatus) {
      report.reportedUser.moderationStatus = { warnings: [], warningCount: 0 };
    }

    report.reportedUser.moderationStatus.spamScore =
      (report.reportedUser.moderationStatus.spamScore || 0) + 1;

    // Auto-restrict if spam score is too high
    if (report.reportedUser.moderationStatus.spamScore >= 5) {
      await handlePostingRestriction(report.reportedUser, moderatorId, 'High spam score', 7);
    }

    await report.reportedUser.save();
  }
};

const handleEducationalIntervention = async (user, moderatorId, reason) => {
  if (!user) return;

  if (!user.moderationStatus) {
    user.moderationStatus = { warnings: [], warningCount: 0 };
  }

  user.moderationStatus.warnings.push({
    type: 'educational_intervention',
    reason,
    issuedBy: moderatorId,
    issuedAt: new Date(),
  });

  // Set flag for educational content delivery
  user.moderationStatus.requiresEducation = true;
  user.moderationStatus.educationTopic = reason;
  await user.save();
};

const updateUserModerationHistory = async (user, moderatorAction) => {
  if (!user) return;

  if (!user.moderationStatus) {
    user.moderationStatus = {
      warnings: [],
      warningCount: 0,
      history: [],
      riskScore: 0
    };
  }

  // Add to moderation history
  if (!user.moderationStatus.history) {
    user.moderationStatus.history = [];
  }

  user.moderationStatus.history.push({
    action: moderatorAction.action,
    reason: moderatorAction.reason,
    severity: moderatorAction.severity,
    moderator: moderatorAction.moderator,
    timestamp: moderatorAction.timestamp
  });

  // Update risk score based on action
  const riskScoreIncrease = {
    'warn_user': 1,
    'remove_content': 2,
    'suspend_user': 3,
    'ban_user': 5,
    'shadow_ban': 3,
    'restrict_posting': 2
  };

  user.moderationStatus.riskScore =
    (user.moderationStatus.riskScore || 0) + (riskScoreIncrease[moderatorAction.action] || 0);

  await user.save();
};

const getAutoModerationStats = async () => {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [autoModerated, autoBlocked, autoFlagged] = await Promise.all([
    Post.countDocuments({
      'moderationFlags.lastChecked': { $gte: weekAgo },
      'moderationFlags': { $exists: true }
    }),
    Post.countDocuments({
      'moderationFlags.lastChecked': { $gte: weekAgo },
      'moderationFlags.shouldBlock': true
    }),
    Post.countDocuments({
      'moderationFlags.lastChecked': { $gte: weekAgo },
      'moderationFlags.shouldFlag': true
    })
  ]);

  return {
    totalAutoModerated: autoModerated,
    autoBlocked,
    autoFlagged,
    efficiency: autoModerated > 0 ? ((autoBlocked + autoFlagged) / autoModerated * 100).toFixed(1) : 0
  };
};

const getModeratorPerformanceStats = async () => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const moderatorStats = await Report.aggregate([
    { $match: { 'moderatorActions.0': { $exists: true } } },
    { $unwind: '$moderatorActions' },
    { $match: { 'moderatorActions.timestamp': { $gte: weekAgo } } },
    {
      $group: {
        _id: '$moderatorActions.moderator',
        actionsCount: { $sum: 1 },
        avgResponseTime: {
          $avg: {
            $subtract: ['$moderatorActions.timestamp', '$createdAt']
          }
        }
      }
    },
    { $sort: { actionsCount: -1 } },
    { $limit: 10 }
  ]);

  // Populate moderator details
  const populatedStats = await User.populate(moderatorStats, {
    path: '_id',
    select: 'name username'
  });

  return populatedStats.map(stat => ({
    moderator: stat._id,
    actionsCount: stat.actionsCount,
    avgResponseTimeHours: Math.round(stat.avgResponseTime / (1000 * 60 * 60) * 10) / 10
  }));
};

const generateModerationAlerts = async () => {
  const alerts = [];
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // Check for spike in reports
  const recentReports = await Report.countDocuments({
    createdAt: { $gte: hourAgo }
  });

  if (recentReports > 20) {
    alerts.push({
      type: 'warning',
      message: `High report volume: ${recentReports} reports in the last hour`,
      priority: 'high'
    });
  }

  // Check for urgent reports
  const urgentReports = await Report.countDocuments({
    status: 'pending',
    priority: 'urgent',
    createdAt: { $lte: new Date(now.getTime() - 2 * 60 * 60 * 1000) } // 2+ hours old
  });

  if (urgentReports > 0) {
    alerts.push({
      type: 'error',
      message: `${urgentReports} urgent reports pending for 2+ hours`,
      priority: 'critical'
    });
  }

  // Check for escalated reports
  const escalatedReports = await Report.countDocuments({
    status: 'escalated',
    isEscalated: true
  });

  if (escalatedReports > 5) {
    alerts.push({
      type: 'info',
      message: `${escalatedReports} reports currently escalated`,
      priority: 'medium'
    });
  }

  return alerts;
};

const getReportFilterOptions = async () => {
  const [reasons, priorities, statuses, contentTypes] = await Promise.all([
    Report.distinct('reason'),
    Report.distinct('priority'),
    Report.distinct('status'),
    Report.distinct('contentType')
  ]);

  return {
    reasons: reasons.sort(),
    priorities: priorities.sort(),
    statuses: statuses.sort(),
    contentTypes: contentTypes.sort(),
    severities: ['low', 'medium', 'high', 'critical']
  };
};

const getRecentUserContent = async (userId) => {
  const [recentPosts, recentMessages] = await Promise.all([
    Post.find({ author: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('content createdAt likes comments moderationFlags'),
    Message.find({ sender: userId, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('message createdAt moderationFlags')
  ]);

  return {
    posts: recentPosts,
    messages: recentMessages,
    totalContent: recentPosts.length + recentMessages.length
  };
};

const findSimilarRiskUsers = async (riskScore) => {
  const similarUsers = await User.find({
    'moderationStatus.riskScore': {
      $gte: Math.max(0, riskScore - 1),
      $lte: riskScore + 1
    }
  })
  .select('username name moderationStatus.riskScore moderationStatus.warningCount')
  .limit(5);

  return similarUsers;
};

const generateModerationTimeline = async (userId) => {
  const timeline = [];

  // Get user's reports (as reporter and reported)
  const [reportsMade, reportsAgainst] = await Promise.all([
    Report.find({ reporter: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('reason createdAt status contentType'),
    Report.find({ reportedUser: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('reason createdAt status moderatorActions')
  ]);

  // Add reports made to timeline
  reportsMade.forEach(report => {
    timeline.push({
      type: 'report_made',
      date: report.createdAt,
      description: `Reported ${report.contentType} for ${report.reason}`,
      status: report.status
    });
  });

  // Add reports against user to timeline
  reportsAgainst.forEach(report => {
    timeline.push({
      type: 'report_received',
      date: report.createdAt,
      description: `Reported for ${report.reason}`,
      status: report.status,
      actions: report.moderatorActions.map(action => ({
        action: action.action,
        date: action.timestamp,
        reason: action.reason
      }))
    });
  });

  // Get user's moderation history
  const user = await User.findById(userId);
  if (user?.moderationStatus?.history) {
    user.moderationStatus.history.forEach(entry => {
      timeline.push({
        type: 'moderation_action',
        date: entry.timestamp,
        description: `${entry.action.replace('_', ' ')} - ${entry.reason}`,
        severity: entry.severity
      });
    });
  }

  // Sort by date (most recent first)
  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  return timeline.slice(0, 50); // Return last 50 events
};

const calculateResponseTimeStats = async (dateFilter) => {
  return await Report.aggregate([
    {
      $match: {
        createdAt: dateFilter,
        status: { $in: ['resolved', 'dismissed'] },
        'resolution.resolvedAt': { $exists: true }
      }
    },
    {
      $addFields: {
        responseTime: { $subtract: ['$resolution.resolvedAt', '$createdAt'] }
      }
    },
    {
      $group: {
        _id: null,
        avgResponseTime: { $avg: '$responseTime' },
        minResponseTime: { $min: '$responseTime' },
        maxResponseTime: { $max: '$responseTime' },
        totalResolved: { $sum: 1 }
      }
    },
    {
      $addFields: {
        avgResponseTimeHours: { $divide: ['$avgResponseTime', 1000 * 60 * 60] },
        minResponseTimeHours: { $divide: ['$minResponseTime', 1000 * 60 * 60] },
        maxResponseTimeHours: { $divide: ['$maxResponseTime', 1000 * 60 * 60] }
      }
    }
  ]);
};

const calculateAccuracyStats = async (dateFilter) => {
  return await Report.aggregate([
    {
      $match: {
        createdAt: dateFilter,
        status: { $in: ['resolved', 'dismissed'] }
      }
    },
    {
      $group: {
        _id: null,
        totalReports: { $sum: 1 },
        resolvedReports: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
        },
        dismissedReports: {
          $sum: { $cond: [{ $eq: ['$status', 'dismissed'] }, 1, 0] }
        },
        escalatedReports: {
          $sum: { $cond: ['$isEscalated', 1, 0] }
        }
      }
    },
    {
      $addFields: {
        resolutionRate: {
          $multiply: [
            { $divide: ['$resolvedReports', '$totalReports'] },
            100
          ]
        },
        dismissalRate: {
          $multiply: [
            { $divide: ['$dismissedReports', '$totalReports'] },
            100
          ]
        },
        escalationRate: {
          $multiply: [
            { $divide: ['$escalatedReports', '$totalReports'] },
            100
          ]
        }
      }
    }
  ]);
};

const generateTrendData = async (dateFilter, groupBy) => {
  let groupFormat;

  switch (groupBy) {
    case 'hour':
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
        hour: { $hour: '$createdAt' }
      };
      break;
    case 'day':
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
      break;
    case 'week':
      groupFormat = {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' }
      };
      break;
    case 'month':
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
      break;
    default:
      groupFormat = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
  }

  return await Report.aggregate([
    { $match: { createdAt: dateFilter } },
    {
      $group: {
        _id: groupFormat,
        reports: { $sum: 1 },
        resolved: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
        },
        dismissed: {
          $sum: { $cond: [{ $eq: ['$status', 'dismissed'] }, 1, 0] }
        },
        pending: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
  ]);
};

// @desc    Get moderation insights and analytics
// @route   GET /api/moderation/insights
// @access  Private (Admin)
export const getModerationInsights = asyncHandler(async (req, res) => {
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
    topReportedUsers,
    mostActiveReporters,
    contentTypeBreakdown,
    severityDistribution,
    repeatOffenders
  ] = await Promise.all([
    // Top reported users
    Report.aggregate([
      { $match: { createdAt: dateFilter } },
      { $group: { _id: '$reportedUser', reportCount: { $sum: 1 } } },
      { $sort: { reportCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          reportCount: 1,
          user: {
            name: 1,
            username: 1,
            'moderationStatus.warningCount': 1
          }
        }
      }
    ]),

    // Most active reporters
    Report.aggregate([
      { $match: { createdAt: dateFilter } },
      { $group: { _id: '$reporter', reportCount: { $sum: 1 } } },
      { $sort: { reportCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          reportCount: 1,
          user: { name: 1, username: 1 }
        }
      }
    ]),

    // Content type breakdown
    Report.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: '$contentType',
          count: { $sum: 1 },
          avgSeverity: { $avg: '$severity' },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]),

    // Severity distribution
    Report.aggregate([
      { $match: { createdAt: dateFilter } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),

    // Repeat offenders
    User.aggregate([
      {
        $match: {
          'moderationStatus.warningCount': { $gte: 3 }
        }
      },
      {
        $project: {
          name: 1,
          username: 1,
          warningCount: '$moderationStatus.warningCount',
          riskScore: '$moderationStatus.riskScore',
          isBanned: '$moderationStatus.isBanned',
          isSuspended: '$moderationStatus.isSuspended'
        }
      },
      { $sort: { warningCount: -1 } },
      { $limit: 20 }
    ])
  ]);

  res.status(200).json({
    success: true,
    data: {
      timeframe,
      insights: {
        topReportedUsers,
        mostActiveReporters,
        contentTypeBreakdown,
        severityDistribution,
        repeatOffenders
      }
    }
  });
});

export default {
  reportContent,
  getModerationDashboard,
  getReports,
  handleReport,
  analyzeUser,
  bulkModerate,
  autoModerate,
  getModerationStatistics,
  getModerationInsights
};