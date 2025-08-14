import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  type: {
    type: String,
    required: [true, 'Notification type is required'],
    enum: [
      'welcome',
      'connection_request',
      'connection_accepted',
      'message',
      'post_like',
      'post_comment',
      'event_reminder',
      'course_completed',
      'badge_earned',
      'level_up',
      'challenge_completed',
      'reward_available',
      'admin_message',
      'system',
    ],
  },
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed, // Additional data specific to notification type
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: Date,
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  actionUrl: String, // URL to redirect when notification is clicked
  icon: String,
  image: String,
  isArchived: {
    type: Boolean,
    default: false,
  },
  expiresAt: Date,
}, {
  timestamps: true,
});

// Indexes
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ createdAt: -1 });

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Static method to create notification
notificationSchema.statics.createNotification = function(notificationData) {
  return this.create(notificationData);
};

// Static method to send welcome message
notificationSchema.statics.sendWelcomeMessage = async function(userId) {
  return this.create({
    recipient: userId,
    type: 'welcome',
    title: 'Welcome to YOU YES YOU! 🎉',
    message: 'Welcome to our brotherhood! Start by completing your profile and introducing yourself in the General Discussion. Your transformation journey begins now.',
    priority: 'high',
    actionUrl: '/profile',
    icon: '👋',
  });
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;