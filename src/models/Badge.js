import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Badge name is required'],
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Badge description is required'],
    trim: true,
  },
  icon: {
    type: String,
    required: [true, 'Badge icon is required'],
  },
  category: {
    type: String,
    required: [true, 'Badge category is required'],
    enum: ['Engagement', 'Learning', 'Community', 'Achievement', 'Streak', 'Special'],
  },
  rarity: {
    type: String,
    enum: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'],
    default: 'Common',
  },
  criteria: {
    type: {
      type: String,
      required: true,
      enum: ['points', 'posts', 'comments', 'courses', 'events', 'streak', 'custom'],
    },
    value: {
      type: Number,
      required: true,
    },
    operator: {
      type: String,
      enum: ['>=', '>', '=', '<', '<='],
      default: '>=',
    },
    timeframe: {
      type: String,
      enum: ['all-time', 'daily', 'weekly', 'monthly'],
      default: 'all-time',
    },
  },
  rewards: {
    points: {
      type: Number,
      default: 0,
    },
    digitalRewards: [{
      type: String,
      description: String,
    }],
    tangibleRewards: [{
      type: String,
      description: String,
      eligibility: String,
    }],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  earnedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    earnedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  order: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Indexes
badgeSchema.index({ category: 1 });
badgeSchema.index({ rarity: 1 });
badgeSchema.index({ isActive: 1 });

// Virtual for how many users have earned this badge
badgeSchema.virtual('earnedCount').get(function() {
  return this.earnedBy ? this.earnedBy.length : 0;
});

// Static method to check if user qualifies for badge
badgeSchema.statics.checkBadgeEligibility = async function(userId, User) {
  const user = await User.findById(userId).populate('courses achievements');
  const badges = await this.find({ isActive: true });
  const earnedBadges = [];

  for (const badge of badges) {
    // Skip if user already has this badge
    if (badge.earnedBy.some(earned => earned.user.toString() === userId.toString())) {
      continue;
    }

    let qualifies = false;
    const { type, value, operator } = badge.criteria;

    switch (type) {
      case 'points':
        qualifies = compareValues(user.points, value, operator);
        break;
      case 'posts':
        const Post = mongoose.model('Post');
        const postCount = await Post.countDocuments({ author: userId, isApproved: true });
        qualifies = compareValues(postCount, value, operator);
        break;
      case 'courses':
        const completedCourses = user.courses.filter(c => c.progress === 100).length;
        qualifies = compareValues(completedCourses, value, operator);
        break;
      case 'streak':
        // Check login streak or other streak types
        const streak = user.streaks?.login?.current || 0;
        qualifies = compareValues(streak, value, operator);
        break;
    }

    if (qualifies) {
      badge.earnedBy.push({ user: userId });
      await badge.save();
      
      // Award points if specified
      if (badge.rewards.points > 0) {
        await user.addPoints(badge.rewards.points, `Earned badge: ${badge.name}`);
      }
      
      earnedBadges.push(badge);
    }
  }

  return earnedBadges;
};

// Helper function to compare values
function compareValues(userValue, targetValue, operator) {
  switch (operator) {
    case '>=': return userValue >= targetValue;
    case '>': return userValue > targetValue;
    case '=': return userValue === targetValue;
    case '<': return userValue < targetValue;
    case '<=': return userValue <= targetValue;
    default: return false;
  }
}

badgeSchema.set('toJSON', { virtuals: true });

const Badge = mongoose.model('Badge', badgeSchema);

export default Badge;