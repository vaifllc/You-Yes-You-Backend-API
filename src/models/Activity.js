import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: [
      'login',
      'signup',
      'logout',
      'post_created',
      'post_liked',
      'post_commented',
      'course_enrolled',
      'course_completed',
      'module_completed',
      'event_joined',
      'event_attended',
      'challenge_joined',
      'challenge_completed',
      'achievement_earned',
      'badge_earned',
      'level_up',
      'connection_request_sent',
      'connection_accepted',
      'message_sent',
      'profile_updated',
      'password_changed',
      'email_verified',
      'feedback_submitted',
      'report_submitted',
      'resource_bookmarked',
      'file_uploaded',
    ],
    index: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
  },
  relatedType: {
    type: String,
    enum: ['post', 'comment', 'course', 'event', 'challenge', 'user', 'achievement', 'badge', 'message', 'feedback', 'report', 'resource'],
  },
  points: {
    type: Number,
    default: 0,
  },
  ipAddress: String,
  userAgent: String,
  location: {
    country: String,
    city: String,
    region: String,
  },
}, {
  timestamps: true,
});

// Indexes
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });
activitySchema.index({ createdAt: -1 });
activitySchema.index({ user: 1, type: 1, createdAt: -1 });

// Static method to log activity
activitySchema.statics.logActivity = async function(userId, type, description, options = {}) {
  const { metadata = {}, relatedId, relatedType, points = 0, req } = options;

  const activityData = {
    user: userId,
    type,
    description,
    metadata,
    points,
  };

  if (relatedId) activityData.relatedId = relatedId;
  if (relatedType) activityData.relatedType = relatedType;

  // Add request metadata if available
  if (req) {
    activityData.ipAddress = req.ip || req.connection.remoteAddress;
    activityData.userAgent = req.get('User-Agent');
  }

  try {
    return await this.create(activityData);
  } catch (error) {
    console.error('Failed to log activity:', error);
    return null;
  }
};

// Static method to get user activity feed
activitySchema.statics.getUserActivity = async function(userId, options = {}) {
  const { page = 1, limit = 20, type, startDate, endDate } = options;

  const query = { user: userId };

  if (type) query.type = type;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const activities = await this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('user', 'name username avatar')
    .lean();

  const total = await this.countDocuments(query);

  return {
    activities,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  };
};

// Static method to get recent activity for dashboard
activitySchema.statics.getRecentActivity = async function(options = {}) {
  const { limit = 10, types, excludeTypes } = options;

  const query = {};

  if (types && types.length > 0) {
    query.type = { $in: types };
  }

  if (excludeTypes && excludeTypes.length > 0) {
    query.type = { $nin: excludeTypes };
  }

  return await this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name username avatar level')
    .lean();
};

// Static method to get activity stats
activitySchema.statics.getActivityStats = async function(timeframe = '7d') {
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
  }

  const [
    totalActivities,
    uniqueUsers,
    topActivities,
    activityByType,
    dailyActivity
  ] = await Promise.all([
    this.countDocuments({ createdAt: dateFilter }),
    this.distinct('user', { createdAt: dateFilter }),
    this.aggregate([
      { $match: { createdAt: dateFilter } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]),
    this.aggregate([
      { $match: { createdAt: dateFilter } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    this.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);

  return {
    totalActivities,
    uniqueUsers: uniqueUsers.length,
    topActivities,
    activityByType,
    dailyActivity,
    timeframe
  };
};

const Activity = mongoose.model('Activity', activitySchema);

export default Activity;
