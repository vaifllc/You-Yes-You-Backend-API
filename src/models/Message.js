import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxLength: [2000, 'Message cannot exceed 2000 characters'],
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text',
  },
  attachments: [{
    url: String,
    filename: String,
    size: Number,
    type: String,
  }],
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
  edited: {
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,
    originalContent: String,
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    emoji: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: Date,
}, {
  timestamps: true,
});

const conversationSchema = new mongoose.Schema({
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
    lastRead: {
      type: Date,
      default: Date.now,
    },
  }],
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct',
  },
  title: String, // For group conversations
  description: String, // For group conversations
  avatar: String, // For group conversations
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
  isArchived: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Indexes
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastActivity: -1 });

// Virtual for unread count
conversationSchema.virtual('unreadCount').get(function() {
  // This will be calculated in the controller
  return this._unreadCount || 0;
});

// Method to mark messages as read
conversationSchema.methods.markAsRead = function(userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (participant) {
    participant.lastRead = new Date();
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Method to add participant
conversationSchema.methods.addParticipant = function(userId) {
  const existingParticipant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (!existingParticipant) {
    this.participants.push({ user: userId });
    return this.save();
  }
  
  return Promise.resolve(this);
};

conversationSchema.set('toJSON', { virtuals: true });

export const Message = mongoose.model('Message', messageSchema);
export const Conversation = mongoose.model('Conversation', conversationSchema);