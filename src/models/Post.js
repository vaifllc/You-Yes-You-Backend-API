import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Post must have an author'],
  },
  content: {
    type: String,
    required: [true, 'Post content is required'],
    trim: true,
    maxLength: [5000, 'Post content cannot exceed 5000 characters'],
  },
  category: {
    type: String,
    required: [true, 'Post category is required'],
    enum: [
      'General Discussion',
      'Announcements',
      'Wins',
      'Questions',
      'Feedback',
      'Resources & Recommendations',
      'Challenge Check-Ins',
      'Real Talk',
    ],
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
  bookmarks: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxLength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    likes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    }],
  }],
  isPinned: {
    type: Boolean,
    default: false,
  },
  isApproved: {
    type: Boolean,
    default: true, // Auto-approve for now, can be changed for moderation
  },
  images: [{
    url: String,
    publicId: String, // For Cloudinary
  }],
  viewCount: {
    type: Number,
    default: 0,
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
postSchema.index({ author: 1 });
postSchema.index({ category: 1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ isPinned: -1, lastActivity: -1 });
postSchema.index({ tags: 1 });

// Virtual for like count
postSchema.virtual('likesCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

postSchema.virtual('bookmarksCount').get(function() {
  return this.bookmarks ? this.bookmarks.length : 0;
});

// Virtual for comment count
postSchema.virtual('commentsCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// Method to check if user liked the post
postSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

postSchema.methods.isBookmarkedBy = function(userId) {
  return this.bookmarks.some(bookmark => bookmark.user.toString() === userId.toString());
};

// Method to toggle like
postSchema.methods.toggleLike = function(userId) {
  const existingLikeIndex = this.likes.findIndex(
    like => like.user.toString() === userId.toString()
  );

  if (existingLikeIndex > -1) {
    // Remove like
    this.likes.splice(existingLikeIndex, 1);
    return false; // Unliked
  } else {
    // Add like
    this.likes.push({ user: userId });
    this.lastActivity = new Date();
    return true; // Liked
  }
};

postSchema.methods.toggleBookmark = function(userId) {
  const existingBookmarkIndex = this.bookmarks.findIndex(
    bookmark => bookmark.user.toString() === userId.toString()
  );

  if (existingBookmarkIndex > -1) {
    this.bookmarks.splice(existingBookmarkIndex, 1);
    return false;
  } else {
    this.bookmarks.push({ user: userId });
    return true;
  }
};

postSchema.methods.toggleCommentLike = function(commentId, userId) {
  const comment = this.comments.id(commentId);
  if (!comment) {
    return null;
  }

  const existingLikeIndex = comment.likes.findIndex(
    like => like.user.toString() === userId.toString()
  );

  if (existingLikeIndex > -1) {
    comment.likes.splice(existingLikeIndex, 1);
    return false;
  } else {
    comment.likes.push({ user: userId });
    return true;
  }
};

// Pre-save middleware to update lastActivity
postSchema.pre('save', function(next) {
  if (this.isModified('comments') || this.isModified('likes')) {
    this.lastActivity = new Date();
  }
  next();
});

// Ensure virtual fields are serialized
postSchema.set('toJSON', { virtuals: true });

const Post = mongoose.model('Post', postSchema);

export default Post;