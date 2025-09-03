import Bookmark from '../models/Bookmark.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// @desc    Toggle bookmark for any item
// @route   POST /api/bookmarks/toggle
// @access  Private
export const toggleBookmark = asyncHandler(async (req, res) => {
  const { itemId, itemType } = req.body;

  if (!itemId || !itemType) {
    return res.status(400).json({ success: false, message: 'itemId and itemType are required' });
  }

  const result = await Bookmark.toggle(req.user._id, itemId, itemType);

  res.status(200).json({ success: true, data: result });
});

// @desc    Get current user's bookmarks (optionally by type)
// @route   GET /api/bookmarks
// @access  Private
export const getUserBookmarks = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, itemType = 'all' } = req.query;

  const { bookmarks, total } = await Bookmark.getUserBookmarks(req.user._id, { page, limit, itemType });

  res.status(200).json({
    success: true,
    data: bookmarks,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Check if a specific item is bookmarked by current user
// @route   GET /api/bookmarks/status?itemId=&itemType=
// @access  Private
export const getBookmarkStatus = asyncHandler(async (req, res) => {
  const { itemId, itemType } = req.query;
  if (!itemId || !itemType) {
    return res.status(400).json({ success: false, message: 'itemId and itemType are required' });
  }

  const isBookmarked = await Bookmark.isBookmarked(req.user._id, itemId, itemType);
  res.status(200).json({ success: true, data: { isBookmarked } });
});

export default {
  toggleBookmark,
  getUserBookmarks,
  getBookmarkStatus,
};
