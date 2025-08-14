import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Resource title is required'],
    trim: true,
    maxLength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    required: [true, 'Resource description is required'],
    trim: true,
    maxLength: [2000, 'Description cannot exceed 2000 characters'],
  },
  category: {
    type: String,
    required: [true, 'Resource category is required'],
    enum: [
      'Housing',
      'Employment',
      'Legal Aid',
      'Mental Health',
      'Financial Services',
      'Education',
      'Healthcare',
      'Transportation',
      'Food Assistance',
      'Childcare',
      'Substance Abuse',
      'Emergency Services',
      'Technology',
      'Other',
    ],
  },
  type: {
    type: String,
    required: [true, 'Resource type is required'],
    enum: ['service', 'organization', 'program', 'tool', 'guide', 'link'],
  },
  contact: {
    phone: String,
    email: String,
    website: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
    },
  },
  eligibility: {
    requirements: [String],
    restrictions: [String],
    phaseAccess: {
      type: [String],
      enum: ['Phase 1', 'Phase 2', 'Phase 3', 'All Phases'],
      default: ['All Phases'],
    },
  },
  availability: {
    hours: String,
    timezone: String,
    daysOfWeek: [String],
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  location: {
    type: String,
    enum: ['National', 'Regional', 'Local', 'Online'],
    default: 'National',
  },
  state: String, // For regional/local resources
  city: String,  // For local resources
  tags: [String],
  featured: {
    type: Boolean,
    default: false,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: String,
    helpful: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    }],
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'inactive'],
    default: 'pending',
  },
  views: {
    type: Number,
    default: 0,
  },
  lastVerified: Date,
  externalLinks: [{
    title: String,
    url: String,
    description: String,
  }],
}, {
  timestamps: true,
});

// Indexes
resourceSchema.index({ category: 1 });
resourceSchema.index({ type: 1 });
resourceSchema.index({ location: 1 });
resourceSchema.index({ state: 1 });
resourceSchema.index({ city: 1 });
resourceSchema.index({ status: 1 });
resourceSchema.index({ featured: -1 });
resourceSchema.index({ 'rating.average': -1 });
resourceSchema.index({ tags: 1 });

// Virtual for helpful count on reviews
resourceSchema.virtual('reviewsWithHelpfulCount').get(function() {
  return this.reviews.map(review => ({
    ...review.toObject(),
    helpfulCount: review.helpful.length,
  }));
});

// Method to update rating
resourceSchema.methods.updateRating = function() {
  if (this.reviews.length === 0) {
    this.rating.average = 0;
    this.rating.count = 0;
    return;
  }
  
  const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
  this.rating.average = totalRating / this.reviews.length;
  this.rating.count = this.reviews.length;
};

// Pre-save middleware
resourceSchema.pre('save', function(next) {
  if (this.isModified('reviews')) {
    this.updateRating();
  }
  next();
});

resourceSchema.set('toJSON', { virtuals: true });

const Resource = mongoose.model('Resource', resourceSchema);

export default Resource;