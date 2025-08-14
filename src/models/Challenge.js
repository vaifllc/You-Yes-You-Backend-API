import mongoose from 'mongoose';

const challengeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Challenge title is required'],
    trim: true,
    maxLength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    required: [true, 'Challenge description is required'],
    trim: true,
    maxLength: [1000, 'Description cannot exceed 1000 characters'],
  },
  type: {
    type: String,
    required: [true, 'Challenge type is required'],
    enum: ['daily', 'weekly', 'monthly', 'custom'],
  },
  duration: {
    type: Number,
    required: [true, 'Challenge duration is required'],
    min: [1, 'Duration must be at least 1 day'],
    max: [365, 'Duration cannot exceed 365 days'],
  },
  category: {
    type: String,
    required: [true, 'Challenge category is required'],
    enum: ['Personal Development', 'Health & Fitness', 'Financial', 'Family', 'Career', 'Education'],
  },
  phase: {
    type: String,
    enum: ['Phase 1', 'Phase 2', 'Phase 3', 'All Phases'],
    default: 'All Phases',
  },
  tasks: [{
    day: Number,
    title: String,
    description: String,
    isRequired: {
      type: Boolean,
      default: true,
    },
  }],
  rewards: {
    points: {
      type: Number,
      default: 25,
    },
    badge: {
      name: String,
      icon: String,
      description: String,
    },
    digitalRewards: [{
      type: String,
      description: String,
      unlockCriteria: String,
    }],
    tangibleRewards: [{
      type: String,
      description: String,
      eligibility: String,
    }],
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    completedTasks: [Number],
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: Date,
  }],
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Indexes
challengeSchema.index({ type: 1 });
challengeSchema.index({ startDate: 1, endDate: 1 });
challengeSchema.index({ isActive: 1, isPublished: 1 });
challengeSchema.index({ phase: 1 });

// Virtual for participant count
challengeSchema.virtual('participantCount').get(function() {
  return this.participants ? this.participants.length : 0;
});

// Virtual for completion rate
challengeSchema.virtual('completionRate').get(function() {
  if (!this.participants || this.participants.length === 0) return 0;
  const completed = this.participants.filter(p => p.isCompleted).length;
  return (completed / this.participants.length) * 100;
});

// Method to join challenge
challengeSchema.methods.addParticipant = function(userId) {
  const existingParticipant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (!existingParticipant) {
    this.participants.push({ user: userId });
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Method to update progress
challengeSchema.methods.updateProgress = function(userId, taskDay) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (participant && !participant.completedTasks.includes(taskDay)) {
    participant.completedTasks.push(taskDay);
    participant.progress = (participant.completedTasks.length / this.tasks.length) * 100;
    
    if (participant.progress >= 100) {
      participant.isCompleted = true;
      participant.completedAt = new Date();
    }
    
    return this.save();
  }
  
  return Promise.resolve(this);
};

challengeSchema.set('toJSON', { virtuals: true });

const Challenge = mongoose.model('Challenge', challengeSchema);

export default Challenge;