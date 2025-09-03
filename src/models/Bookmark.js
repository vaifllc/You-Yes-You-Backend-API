import mongoose from 'mongoose';

const bookmarkSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  itemType: {
    type: String,
    enum: ['post', 'course', 'resource', 'event', 'challenge', 'feedback'],
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    type: Object,
    default: {},
  },
});

bookmarkSchema.index({ user: 1, itemId: 1, itemType: 1 }, { unique: true });

bookmarkSchema.statics.toggle = async function toggle(userId, itemId, itemType) {
  const existing = await this.findOne({ user: userId, itemId, itemType });
  if (existing) {
    await this.deleteOne({ _id: existing._id });
    return { isBookmarked: false };
  }
  await this.create({ user: userId, itemId, itemType });
  return { isBookmarked: true };
};

bookmarkSchema.statics.isBookmarked = async function isBookmarked(userId, itemId, itemType) {
  const existing = await this.exists({ user: userId, itemId, itemType });
  return Boolean(existing);
};

bookmarkSchema.statics.getUserBookmarks = async function getUserBookmarks(userId, { page = 1, limit = 20, itemType }) {
  const query = { user: userId };
  if (itemType && itemType !== 'all') query.itemType = itemType;

  const bookmarks = await this.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit))
    .lean();

  const total = await this.countDocuments(query);

  return { bookmarks, total };
};

const Bookmark = mongoose.model('Bookmark', bookmarkSchema);
export default Bookmark;
