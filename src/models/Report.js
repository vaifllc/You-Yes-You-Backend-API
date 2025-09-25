import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  contentType: {
    type: String,
    required: [true, 'Content type is required'],
    enum: ['post', 'comment', 'message', 'user', 'resource'],
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  reason: {
    type: String,
    required: [true, 'Report reason is required'],
    enum: [
      'spam',
      'harassment',
      'hate_speech',
      'inappropriate_content',
      'misinformation',
      'violence',
      'self_harm',
      'illegal_activity',
      'personal_information',
      'impersonation',
      'copyright',
      'other',
    ],
  },
  description: {
    type: String,
    trim: true,
    maxLength: [1000, 'Report description cannot exceed 1000 characters'],
  },
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
    default: 'pending',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  moderatorActions: [{
    moderator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    action: {
      type: String,
      enum: [
        'content_removed',
        'content_edited',
        'user_warned',
        'user_suspended',
        'user_banned',
        'shadow_ban',
        'restrict_posting',
        'require_approval',
        'mark_spam',
        'educational_intervention',
        'custom',
        'report_dismissed',
        'escalated',
      ],
    },
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    notes: String,
  }],
  resolution: {
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: Date,
    resolution: String,
    actionTaken: String,
  },
  evidenceUrls: [String],
  category: String, // Auto-assigned based on content analysis
  severity: {
    type: Number,
    min: 1,
    max: 10,
    default: 5,
  },
}, {
  timestamps: true,
});

// Indexes
reportSchema.index({ reporter: 1 });
reportSchema.index({ reportedUser: 1 });
reportSchema.index({ contentType: 1, contentId: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ priority: 1 });
reportSchema.index({ createdAt: -1 });

// Method to escalate report
reportSchema.methods.escalate = function(moderatorId, reason) {
  this.priority = 'urgent';
  this.moderatorActions.push({
    moderator: moderatorId,
    action: 'escalated',
    reason,
    timestamp: new Date(),
  });
  return this.save();
};

// Method to resolve report
reportSchema.methods.resolve = function(moderatorId, resolution, actionTaken) {
  this.status = 'resolved';
  this.resolution = {
    resolvedBy: moderatorId,
    resolvedAt: new Date(),
    resolution,
    actionTaken,
  };
  return this.save();
};

const Report = mongoose.model('Report', reportSchema);

export default Report;