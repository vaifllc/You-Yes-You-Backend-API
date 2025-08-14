import mongoose from 'mongoose';

const rewardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Reward name is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Reward description is required'],
    trim: true,
  },
  type: {
    type: String,
    required: [true, 'Reward type is required'],
    enum: ['digital', 'tangible', 'experience'],
  },
  category: {
    type: String,
    required: [true, 'Reward category is required'],
    enum: [
      'Course Access',
      'Certificates',
      'Merchandise',
      'Gift Cards',
      'Books',
      'Coaching',
      'Spotlight',
      'Special Access',
    ],
  },
  value: {
    type: String, // e.g., "$25 Gift Card", "Branded T-Shirt", "Bonus Course"
    required: [true, 'Reward value is required'],
  },
  pointsCost: {
    type: Number,
    default: 0,
    min: [0, 'Points cost cannot be negative'],
  },
  levelRequired: {
    type: String,
    enum: ['New Member', 'Builder', 'Overcomer', 'Mentor-in-Training', 'Legacy Leader'],
  },
  phaseRequired: {
    type: String,
    enum: ['Phase 1', 'Phase 2', 'Phase 3'],
  },
  availability: {
    stock: {
      type: Number,
      default: -1, // -1 means unlimited
    },
    maxPerUser: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startDate: Date,
    endDate: Date,
  },
  claimedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    claimedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    shippingInfo: {
      address: String,
      trackingNumber: String,
      shippedAt: Date,
      deliveredAt: Date,
    },
    notes: String,
  }],
  digitalContent: {
    accessUrl: String,
    downloadUrl: String,
    unlockCode: String,
    instructions: String,
  },
  images: [String],
  isAutomatic: {
    type: Boolean,
    default: false, // If true, automatically awarded when criteria met
  },
  automaticCriteria: {
    type: String,
    description: String,
  },
}, {
  timestamps: true,
});

// Indexes
rewardSchema.index({ type: 1 });
rewardSchema.index({ category: 1 });
rewardSchema.index({ 'availability.isActive': 1 });
rewardSchema.index({ pointsCost: 1 });

// Virtual for remaining stock
rewardSchema.virtual('remainingStock').get(function() {
  if (this.availability.stock === -1) return 'Unlimited';
  return Math.max(0, this.availability.stock - this.claimedBy.length);
});

// Virtual for times claimed
rewardSchema.virtual('timesClaimed').get(function() {
  return this.claimedBy ? this.claimedBy.length : 0;
});

// Method to check if user can claim reward
rewardSchema.methods.canUserClaim = function(user) {
  // Check if reward is active
  if (!this.availability.isActive) return { canClaim: false, reason: 'Reward is not active' };
  
  // Check stock
  if (this.availability.stock !== -1 && this.timesClaimed >= this.availability.stock) {
    return { canClaim: false, reason: 'Reward is out of stock' };
  }
  
  // Check user points
  if (user.points < this.pointsCost) {
    return { canClaim: false, reason: 'Insufficient points' };
  }
  
  // Check level requirement
  if (this.levelRequired && user.level !== this.levelRequired) {
    return { canClaim: false, reason: `Requires ${this.levelRequired} level` };
  }
  
  // Check phase requirement
  if (this.phaseRequired && user.phase !== this.phaseRequired) {
    return { canClaim: false, reason: `Requires ${this.phaseRequired}` };
  }
  
  // Check max per user
  const userClaims = this.claimedBy.filter(claim => 
    claim.user.toString() === user._id.toString()
  ).length;
  
  if (userClaims >= this.availability.maxPerUser) {
    return { canClaim: false, reason: 'Maximum claims reached for this user' };
  }
  
  // Check date restrictions
  const now = new Date();
  if (this.availability.startDate && now < this.availability.startDate) {
    return { canClaim: false, reason: 'Reward not yet available' };
  }
  
  if (this.availability.endDate && now > this.availability.endDate) {
    return { canClaim: false, reason: 'Reward period has ended' };
  }
  
  return { canClaim: true };
};

// Method to claim reward
rewardSchema.methods.claimReward = async function(userId, shippingInfo = null) {
  const claim = {
    user: userId,
    shippingInfo,
  };
  
  this.claimedBy.push(claim);
  await this.save();
  
  return claim;
};

rewardSchema.set('toJSON', { virtuals: true });

const Reward = mongoose.model('Reward', rewardSchema);

export default Reward;