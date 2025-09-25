import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: [
      'user_signup', 'user_login', 'user_profile_update', 'user_password_change',
      'post_created', 'post_updated', 'post_deleted', 'post_liked', 'post_bookmarked',
      'comment_created', 'comment_updated', 'comment_deleted', 'comment_liked',
      'course_enrolled', 'course_completed', 'module_completed',
      'event_rsvp', 'event_attended', 'event_created', 'event_updated', 'event_deleted',
      'challenge_joined', 'challenge_progress_update', 'challenge_completed',
      'badge_earned', 'level_up', 'reward_claimed',
      'feedback_submitted', 'feedback_responded', 'feedback_flagged',
      'message_sent', 'message_received', 'message_edited', 'message_deleted',
      'connection_sent', 'connection_accepted', 'connection_declined', 'connection_blocked',
      'admin_action', 'system_notification', 'resource_viewed', 'resource_submitted',
      'file_uploaded', 'file_downloaded',
    ],
  },
  description: {
    type: String,
    required: true,
    maxLength: 500,
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedType',
  },
  relatedType: {
    type: String,
    enum: ['User', 'Post', 'Comment', 'Course', 'Event', 'Challenge', 'Badge', 'Reward', 'Feedback', 'Message', 'Connection', 'Resource', 'File'],
  },
  pointsAwarded: {
    type: Number,
    default: 0,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
}, { timestamps: true });

// Indexes for performance
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });
activitySchema.index({ relatedId: 1, relatedType: 1 });

// Static method to log activity
activitySchema.statics.logActivity = async function(userId, type, description, options = {}) {
  const { relatedId, relatedType, points, req } = options;

  // Extract metadata from request
  const metadata = {
    ipAddress: req?.ip,
    userAgent: req?.get('User-Agent'),
    platform: req?.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop',
    browser: req?.get('User-Agent')?.includes('Chrome') ? 'Chrome' : 'Other',
    ...options.metadata,
  };

  return this.create({
    user: userId,
    type,
    description,
    relatedId,
    relatedType,
    pointsAwarded: points || 0,
    metadata,
  });
};

// Static method to get recent activity
activitySchema.statics.getRecentActivity = async function({ limit = 10, userId, type, relatedType } = {}) {
  const query = {};
  if (userId) query.user = userId;
  if (type) query.type = type;
  if (relatedType) query.relatedType = relatedType;

  return this.find(query)
    .populate('user', 'name username avatar')
    .sort({ createdAt: -1 })
    .limit(limit);
};

const Activity = mongoose.model('Activity', activitySchema);

export default Activity;