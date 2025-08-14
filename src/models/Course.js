import mongoose from 'mongoose';

const moduleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Module title is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Module description is required'],
    trim: true,
  },
  duration: {
    type: String,
    required: [true, 'Module duration is required'],
  },
  content: {
    type: String,
    required: [true, 'Module content is required'],
  },
  videoUrl: String,
  resources: [{
    title: String,
    url: String,
    type: {
      type: String,
      enum: ['pdf', 'video', 'link', 'exercise'],
    },
  }],
  quiz: [{
    question: String,
    options: [String],
    correctAnswer: Number,
    explanation: String,
  }],
  order: {
    type: Number,
    required: true,
  },
  isRequired: {
    type: Boolean,
    default: true,
  },
});

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Course description is required'],
    trim: true,
  },
  thumbnail: {
    type: String,
    default: 'https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  category: {
    type: String,
    required: [true, 'Course category is required'],
    enum: ['Personal Development', 'Financial Literacy', 'Entrepreneurship', 'Life Skills'],
  },
  phase: {
    type: String,
    required: [true, 'Course phase is required'],
    enum: ['Phase 1', 'Phase 2', 'Phase 3'],
  },
  level: {
    type: String,
    required: [true, 'Course level is required'],
    enum: ['Beginner', 'Intermediate', 'Advanced'],
  },
  instructor: {
    type: String,
    required: [true, 'Instructor name is required'],
    trim: true,
  },
  instructorBio: {
    type: String,
    trim: true,
  },
  instructorAvatar: {
    type: String,
    default: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  modules: [moduleSchema],
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
  }],
  skills: [String],
  learningObjectives: [String],
  estimatedDuration: {
    type: String,
    required: [true, 'Estimated duration is required'],
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Medium',
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  enrollmentCount: {
    type: Number,
    default: 0,
  },
  completionRate: {
    type: Number,
    default: 0,
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
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
  price: {
    type: Number,
    default: 0,
    min: 0,
  },
  tags: [String],
}, {
  timestamps: true,
});

// Indexes
courseSchema.index({ category: 1 });
courseSchema.index({ phase: 1 });
courseSchema.index({ isPublished: 1 });
courseSchema.index({ 'rating.average': -1 });
courseSchema.index({ enrollmentCount: -1 });

// Virtual for total modules
courseSchema.virtual('moduleCount').get(function() {
  return this.modules ? this.modules.length : 0;
});

// Virtual for total duration in minutes
courseSchema.virtual('totalDurationMinutes').get(function() {
  if (!this.modules || this.modules.length === 0) return 0;
  
  return this.modules.reduce((total, module) => {
    const duration = module.duration;
    const minutes = parseInt(duration.match(/\d+/)?.[0]) || 0;
    return total + minutes;
  }, 0);
});

// Method to calculate completion rate
courseSchema.methods.calculateCompletionRate = async function() {
  const User = mongoose.model('User');
  const enrolledUsers = await User.countDocuments({
    'courses.courseId': this._id,
  });
  
  const completedUsers = await User.countDocuments({
    'courses.courseId': this._id,
    'courses.progress': 100,
  });
  
  this.completionRate = enrolledUsers > 0 ? (completedUsers / enrolledUsers) * 100 : 0;
  return this.save();
};

// Method to update rating
courseSchema.methods.updateRating = function() {
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
courseSchema.pre('save', function(next) {
  if (this.isModified('reviews')) {
    this.updateRating();
  }
  next();
});

// Ensure virtual fields are serialized
courseSchema.set('toJSON', { virtuals: true });

const Course = mongoose.model('Course', courseSchema);

export default Course;