import mongoose from 'mongoose';

const integrationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Integration name is required'],
    unique: true,
    trim: true,
  },
  type: {
    type: String,
    required: [true, 'Integration type is required'],
    enum: ['zapier', 'email', 'calendar', 'payment', 'analytics', 'crm', 'lms', 'chatbot', 'social'],
  },
  provider: {
    type: String,
    required: [true, 'Provider name is required'],
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  configuration: {
    apiKey: String,
    apiSecret: String,
    webhookUrl: String,
    settings: mongoose.Schema.Types.Mixed,
  },
  permissions: {
    read: {
      type: Boolean,
      default: false,
    },
    write: {
      type: Boolean,
      default: false,
    },
    webhook: {
      type: Boolean,
      default: false,
    },
  },
  endpoints: [{
    name: String,
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'DELETE'],
    },
    url: String,
    description: String,
  }],
  events: [{
    trigger: String,
    action: String,
    isActive: {
      type: Boolean,
      default: true,
    },
  }],
  statistics: {
    totalCalls: {
      type: Number,
      default: 0,
    },
    successfulCalls: {
      type: Number,
      default: 0,
    },
    failedCalls: {
      type: Number,
      default: 0,
    },
    lastCall: Date,
    lastSuccess: Date,
    lastError: {
      message: String,
      timestamp: Date,
    },
  },
  rateLimit: {
    requestsPerMinute: {
      type: Number,
      default: 60,
    },
    requestsPerHour: {
      type: Number,
      default: 1000,
    },
  },
}, {
  timestamps: true,
});

// Indexes
integrationSchema.index({ type: 1 });
integrationSchema.index({ provider: 1 });
integrationSchema.index({ isActive: 1 });

// Method to log API call
integrationSchema.methods.logApiCall = function(success = true, error = null) {
  this.statistics.totalCalls += 1;
  this.statistics.lastCall = new Date();
  
  if (success) {
    this.statistics.successfulCalls += 1;
    this.statistics.lastSuccess = new Date();
  } else {
    this.statistics.failedCalls += 1;
    if (error) {
      this.statistics.lastError = {
        message: error.message,
        timestamp: new Date(),
      };
    }
  }
  
  return this.save();
};

// Static method to get active integrations by type
integrationSchema.statics.getActiveByType = function(type) {
  return this.find({ type, isActive: true });
};

const Integration = mongoose.model('Integration', integrationSchema);

export default Integration;