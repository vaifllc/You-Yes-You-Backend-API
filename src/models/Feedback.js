import mongoose from 'mongoose';

const feedbackResponseSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isOfficial: {
    type: Boolean,
    default: false
  },
  attachments: [{
    url: String,
    fileName: String,
    fileType: String,
    fileSize: Number
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const feedbackSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  category: {
    type: String,
    enum: ['bug', 'feature', 'improvement', 'general', 'question'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed'],
    required: true,
    default: 'open'
  },
  type: {
    type: String,
    enum: ['feedback', 'suggestion', 'complaint', 'praise'],
    required: true,
    default: 'feedback'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  responses: [feedbackResponseSchema],
  attachments: [{
    url: String,
    fileName: String,
    fileType: String,
    fileSize: Number
  }],
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  views: {
    type: Number,
    default: 0
  },
  bookmarkedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    bookmarkedAt: {
      type: Date,
      default: Date.now
    }
  }],
  flaggedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    flaggedAt: {
      type: Date,
      default: Date.now
    },
    reason: String
  }],
  moderationStatus: {
    isApproved: {
      type: Boolean,
      default: true
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    moderatedAt: Date,
    moderationNotes: String
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    platform: String,
    browser: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
feedbackSchema.index({ category: 1, status: 1, priority: 1 });
feedbackSchema.index({ author: 1, createdAt: -1 });
feedbackSchema.index({ assignedTo: 1, status: 1 });
feedbackSchema.index({ tags: 1 });
feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ 'responses.author': 1 });

// Virtual for response count
feedbackSchema.virtual('responseCount').get(function() {
  return this.responses.length;
});

// Virtual for isUserAuthor (will be populated on frontend)
feedbackSchema.virtual('isUserAuthor').get(function() {
  return false; // This will be set on the frontend
});

// Methods
feedbackSchema.methods.addResponse = async function(responseData) {
  this.responses.push(responseData);
  this.updatedAt = new Date();
  return await this.save();
};

feedbackSchema.methods.updateStatus = async function(newStatus, updatedBy) {
  this.status = newStatus;
  this.updatedAt = new Date();

  if (updatedBy) {
    this.assignedTo = updatedBy;
  }

  return await this.save();
};

feedbackSchema.methods.toggleBookmark = async function(userId) {
  const existingBookmark = this.bookmarkedBy.find(
    bookmark => bookmark.user.toString() === userId.toString()
  );

  if (existingBookmark) {
    this.bookmarkedBy = this.bookmarkedBy.filter(
      bookmark => bookmark.user.toString() !== userId.toString()
    );
  } else {
    this.bookmarkedBy.push({
      user: userId,
      bookmarkedAt: new Date()
    });
  }

  return await this.save();
};

feedbackSchema.methods.toggleFlag = async function(userId, reason = '') {
  const existingFlag = this.flaggedBy.find(
    flag => flag.user.toString() === userId.toString()
  );

  if (existingFlag) {
    this.flaggedBy = this.flaggedBy.filter(
      flag => flag.user.toString() !== userId.toString()
    );
  } else {
    this.flaggedBy.push({
      user: userId,
      flaggedAt: new Date(),
      reason
    });
  }

  return await this.save();
};

feedbackSchema.methods.incrementViews = async function() {
  this.views += 1;
  return await this.save();
};

// Static methods
feedbackSchema.statics.getFeedbackWithFilters = async function(filters, userId = null) {
  const query = {};

  if (filters.category && filters.category !== 'all') {
    query.category = filters.category;
  }

  if (filters.status && filters.status !== 'all') {
    query.status = filters.status;
  }

  if (filters.priority && filters.priority !== 'all') {
    query.priority = filters.priority;
  }

  if (filters.type && filters.type !== 'all') {
    query.type = filters.type;
  }

  if (filters.search) {
    query.$or = [
      { title: { $regex: filters.search, $options: 'i' } },
      { description: { $regex: filters.search, $options: 'i' } },
      { tags: { $in: [new RegExp(filters.search, 'i')] } }
    ];
  }

  if (filters.author) {
    query.author = filters.author;
  }

  if (filters.assignedTo) {
    query.assignedTo = filters.assignedTo;
  }

  // Only show approved feedback unless user is admin
  if (!userId || !filters.isAdmin) {
    query['moderationStatus.isApproved'] = true;
  }

  return query;
};

feedbackSchema.statics.getFeedbackStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
        bugs: { $sum: { $cond: [{ $eq: ['$category', 'bug'] }, 1, 0] } },
        features: { $sum: { $cond: [{ $eq: ['$category', 'feature'] }, 1, 0] } },
        improvements: { $sum: { $cond: [{ $eq: ['$category', 'improvement'] }, 1, 0] } },
        questions: { $sum: { $cond: [{ $eq: ['$category', 'question'] }, 1, 0] } },
        general: { $sum: { $cond: [{ $eq: ['$category', 'general'] }, 1, 0] } }
      }
    }
  ]);

  return stats[0] || {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    bugs: 0,
    features: 0,
    improvements: 0,
    questions: 0,
    general: 0
  };
};

// Ensure virtuals are included when converting to JSON
feedbackSchema.set('toJSON', { virtuals: true });
feedbackSchema.set('toObject', { virtuals: true });

const Feedback = mongoose.model('Feedback', feedbackSchema);

export default Feedback;
