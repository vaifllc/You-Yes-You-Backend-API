import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxLength: [100, 'Name cannot exceed 100 characters'],
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minLength: [3, 'Username must be at least 3 characters'],
    maxLength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minLength: [6, 'Password must be at least 6 characters'],
    select: false, // Don't include password in queries by default
  },
  avatar: {
    type: String,
    default: 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  bio: {
    type: String,
    maxLength: [500, 'Bio cannot exceed 500 characters'],
    default: '',
  },
  location: {
    type: String,
    maxLength: [100, 'Location cannot exceed 100 characters'],
    default: '',
  },
  phase: {
    type: String,
    enum: ['Phase 1', 'Phase 2', 'Phase 3'],
    default: 'Phase 1',
  },
  skills: [{
    type: String,
    trim: true,
  }],
  joinDate: {
    type: String,
    default: () => new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    }),
  },
  points: {
    type: Number,
    default: 0,
    min: [0, 'Points cannot be negative'],
  },
  level: {
    type: String,
    default: 'New Member',
    enum: ['New Member', 'Builder', 'Overcomer', 'Mentor-in-Training', 'Legacy Leader'],
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  courses: [{
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    completedModules: [String],
    lastAccessed: Date,
  }],
  achievements: [{
    title: String,
    description: String,
    icon: String,
    earnedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  pointsHistory: [{
    action: String,
    points: Number,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
  streaks: {
    login: {
      current: {
        type: Number,
        default: 0,
      },
      longest: {
        type: Number,
        default: 0,
      },
      lastUpdate: Date,
    },
    post: {
      current: {
        type: Number,
        default: 0,
      },
      longest: {
        type: Number,
        default: 0,
      },
      lastUpdate: Date,
    },
    event: {
      current: {
        type: Number,
        default: 0,
      },
      longest: {
        type: Number,
        default: 0,
      },
      lastUpdate: Date,
    },
    challenge: {
      current: {
        type: Number,
        default: 0,
      },
      longest: {
        type: Number,
        default: 0,
      },
      lastUpdate: Date,
    },
  },
  warnings: [{
    type: {
      type: String,
      enum: ['warning', 'suspension', 'banned'],
      required: true,
    },
    reason: String,
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
  }],
  connections: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    type: {
      type: String,
      enum: ['brotherhood', 'mentorship', 'accountability'],
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  notificationPreferences: {
    email: {
      newMessages: { type: Boolean, default: true },
      connectionRequests: { type: Boolean, default: true },
      badgeEarned: { type: Boolean, default: true },
      eventReminders: { type: Boolean, default: true },
      courseUpdates: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: true },
    },
    push: {
      newMessages: { type: Boolean, default: true },
      connectionRequests: { type: Boolean, default: true },
      badgeEarned: { type: Boolean, default: true },
      eventReminders: { type: Boolean, default: false },
      courseUpdates: { type: Boolean, default: false },
    },
  },
}, {
  timestamps: true,
});

// Index for better query performance (ensure declared once)
// Use plain indexes here to avoid duplicating unique defs on fields
userSchema.index({ points: -1 });
userSchema.index({ 'courses.courseId': 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to update user level based on points
userSchema.methods.updateLevel = function() {
  if (this.points >= 750) {
    this.level = 'Legacy Leader';
  } else if (this.points >= 500) {
    this.level = 'Mentor-in-Training';
  } else if (this.points >= 250) {
    this.level = 'Overcomer';
  } else if (this.points >= 100) {
    this.level = 'Builder';
  } else {
    this.level = 'New Member';
  }
};

// Method to add points
userSchema.methods.addPoints = function(points, action) {
  const oldLevel = this.level;
  this.points += points;
  this.pointsHistory.push({ action, points });
  this.updateLevel();

  // Check if user leveled up
  if (this.level !== oldLevel) {
    // Trigger level up webhook
    setTimeout(async () => {
      try {
        await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhooks/zapier/level_up`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.PLATFORM_API_KEY,
          },
          body: JSON.stringify({
            userId: this._id,
            oldLevel,
            newLevel: this.level,
            totalPoints: this.points,
          }),
        });
      } catch (error) {
        console.log('Level up webhook failed:', error.message);
      }
    }, 1000);
  }

  return this.save();
};

// Virtual for user's rank (will be calculated in aggregation)
userSchema.virtual('rank').get(function() {
  return this._rank || null;
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });

const User = mongoose.model('User', userSchema);

export default User;