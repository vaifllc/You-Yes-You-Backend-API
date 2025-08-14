import mongoose from 'mongoose';

const connectionSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    required: [true, 'Connection type is required'],
    enum: ['brotherhood', 'mentorship', 'accountability'],
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'blocked'],
    default: 'pending',
  },
  message: {
    type: String,
    trim: true,
    maxLength: [500, 'Connection message cannot exceed 500 characters'],
  },
  template: {
    type: String,
    enum: ['brotherhood', 'mentorship', 'accountability', 'custom'],
    default: 'custom',
  },
  connectionDate: Date,
  blockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  blockedAt: Date,
  lastInteraction: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    requesterPhase: String,
    recipientPhase: String,
    commonInterests: [String],
    sharedCourses: [String],
  },
}, {
  timestamps: true,
});

// Indexes
connectionSchema.index({ requester: 1 });
connectionSchema.index({ recipient: 1 });
connectionSchema.index({ status: 1 });
connectionSchema.index({ type: 1 });
connectionSchema.index({ createdAt: -1 });

// Compound index for finding connections between two users
connectionSchema.index({ requester: 1, recipient: 1 });

// Static method to get connection templates
connectionSchema.statics.getTemplates = function() {
  return {
    brotherhood: "Hey {name}! I'd love to connect with you as part of our YOU YES YOU brotherhood. Looking forward to supporting each other on this journey.",
    mentorship: "Hi {name}, I noticed you're further along in your journey and would love to learn from your experience. Would you be open to connecting for mentorship?",
    accountability: "Hello {name}! I'm looking for an accountability partner to help keep me on track with my goals. Would you be interested in connecting?",
  };
};

// Method to check if users are already connected
connectionSchema.statics.findExistingConnection = function(userId1, userId2) {
  return this.findOne({
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 },
    ],
  });
};

// Method to get user's connections
connectionSchema.statics.getUserConnections = function(userId, status = 'accepted') {
  return this.find({
    $or: [
      { requester: userId, status },
      { recipient: userId, status },
    ],
  }).populate('requester recipient', 'name username avatar level phase isOnline');
};

const Connection = mongoose.model('Connection', connectionSchema);

export default Connection;