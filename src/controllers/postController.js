import Post from '../models/Post.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// @desc    Get all posts
// @route   GET /api/posts
// @access  Public
export const getPosts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    search,
    tags,
    sortBy = 'latest'
  } = req.query;

  // Build query
  const query = { isApproved: true };

  if (category && category !== 'all') {
    query.category = category;
  }

  if (search) {
    query.$or = [
      { content: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } },
    ];
  }

  if (tags) {
    const tagArray = tags.split(',').map(tag => tag.trim());
    query.tags = { $in: tagArray };
  }

  // Build sort object
  let sort = {};
  switch (sortBy) {
    case 'latest':
      sort = { isPinned: -1, createdAt: -1 };
      break;
    case 'popular':
      sort = { isPinned: -1, likesCount: -1 };
      break;
    case 'active':
      sort = { isPinned: -1, lastActivity: -1 };
      break;
    default:
      sort = { isPinned: -1, createdAt: -1 };
  }

  // Execute query with pagination
  const posts = await Post.find(query)
    .populate('author', 'name username avatar level isOnline')
    .populate('comments.user', 'name username avatar')
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean({ getters: true });

  // Add virtual fields manually since we're using lean()
  posts.forEach(post => {
    post.likesCount = post.likes ? post.likes.length : 0;
    post.commentsCount = post.comments ? post.comments.length : 0;
    post.bookmarksCount = post.bookmarks ? post.bookmarks.length : 0;

    // Check if current user liked the post
    if (req.user) {
      post.isLikedByUser = post.likes?.some(
        like => like.user.toString() === req.user._id.toString()
      ) || false;
      post.isBookmarkedByUser = post.bookmarks?.some(
        bookmark => bookmark.user.toString() === req.user._id.toString()
      ) || false;
    }
  });

  // Get total count for pagination
  const total = await Post.countDocuments(query);

  res.status(200).json({
    success: true,
    data: posts,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Public
export const getPost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id)
    .populate('author', 'name username avatar level isOnline bio')
    .populate('comments.user', 'name username avatar level')
    .populate('likes.user', 'name username avatar');

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  // Increment view count
  post.viewCount += 1;
  await post.save();

  // Check if current user liked the post
  let isLikedByUser = false;
  let isBookmarkedByUser = false;
  if (req.user) {
    isLikedByUser = post.isLikedBy(req.user._id);
    isBookmarkedByUser = post.isBookmarkedBy(req.user._id);
  }

  res.status(200).json({
    success: true,
    data: {
      ...post.toJSON(),
      isLikedByUser,
      isBookmarkedByUser,
    },
  });
});

// @desc    Create new post
// @route   POST /api/posts
// @access  Private
export const createPost = asyncHandler(async (req, res) => {
  const { content, category, tags, images } = req.body;

  // Normalize images from client: accept array of strings or objects
  let normalizedImages = [];
  if (Array.isArray(images)) {
    normalizedImages = images
      .filter(Boolean)
      .map((img) => {
        if (typeof img === 'string') {
          return { url: img };
        }
        if (img && typeof img === 'object' && typeof img.url === 'string') {
          return { url: img.url, publicId: img.publicId };
        }
        return null;
      })
      .filter(Boolean);
  }

  const post = await Post.create({
    author: req.user._id,
    content,
    category,
    tags: tags || [],
    images: normalizedImages,
    isApproved: !req.contentModeration?.flagged, // Use middleware result
  });

  // Award points for creating post
  await req.user.addPoints(5, 'Created post');

  // Update post streak
  const { updateStreak, STREAK_TYPES } = await import('../utils/streakTracker.js');
  await updateStreak(req.user._id, STREAK_TYPES.POST);

  // Populate author info
  await post.populate('author', 'name username avatar level isOnline');

  res.status(201).json({
    success: true,
    message: req.contentModeration?.flagged
      ? 'Post submitted for review due to content flags'
      : 'Post created successfully',
    data: post,
  });
});

// @desc    Update post
// @route   PUT /api/posts/:id
// @access  Private
export const updatePost = asyncHandler(async (req, res) => {
  const { content, category, tags } = req.body;

  let post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  // Check ownership
  if (!req.checkOwnership(post)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this post',
    });
  }

  // Update fields
  if (content) post.content = content;
  if (category) post.category = category;
  if (tags) post.tags = tags;

  await post.save();
  await post.populate('author', 'name username avatar level isOnline');

  res.status(200).json({
    success: true,
    message: 'Post updated successfully',
    data: post,
  });
});

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
export const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  // Check ownership
  if (!req.checkOwnership(post)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this post',
    });
  }

  await Post.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Post deleted successfully',
  });
});

// @desc    Like/unlike post
// @route   PUT /api/posts/:id/like
// @access  Private
export const toggleLike = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  const isLiked = post.toggleLike(req.user._id);
  await post.save();

  // Award points if liked (not for unliking)
  if (isLiked) {
    await req.user.addPoints(1, 'Liked post');
  }

  res.status(200).json({
    success: true,
    message: isLiked ? 'Post liked' : 'Post unliked',
    data: {
      isLiked,
      likesCount: post.likesCount,
    },
  });
});

// @desc    Bookmark/unbookmark post
// @route   PUT /api/posts/:id/bookmark
// @access  Private
export const toggleBookmark = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  const isBookmarked = post.toggleBookmark(req.user._id);
  await post.save();

  res.status(200).json({
    success: true,
    message: isBookmarked ? 'Post bookmarked' : 'Post unbookmarked',
    data: {
      isBookmarked,
      bookmarksCount: post.bookmarksCount,
    },
  });
});

// @desc    Add comment to post
// @route   POST /api/posts/:id/comments
// @access  Private
export const addComment = asyncHandler(async (req, res) => {
  const { content } = req.body;

  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  // Add comment
  const comment = {
    user: req.user._id,
    content, // Content already cleaned by middleware
    timestamp: new Date(),
  };

  post.comments.push(comment);
  await post.save();

  // Award points for commenting
  await req.user.addPoints(3, 'Added comment');

  // Populate the new comment
  await post.populate('comments.user', 'name username avatar level');

  // Get the newly added comment
  const newComment = post.comments[post.comments.length - 1];

  res.status(201).json({
    success: true,
    message: req.contentModeration?.flagged
      ? 'Comment added (content filtered)'
      : 'Comment added successfully',
    data: newComment,
  });
});

// @desc    Update comment
// @route   PUT /api/posts/:postId/comments/:commentId
// @access  Private
export const updateComment = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const { postId, commentId } = req.params;

  const post = await Post.findById(postId);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  const comment = post.comments.id(commentId);

  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'Comment not found',
    });
  }

  // Check ownership
  if (comment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this comment',
    });
  }

  comment.content = content;
  await post.save();

  res.status(200).json({
    success: true,
    message: 'Comment updated successfully',
    data: comment,
  });
});

// @desc    Delete comment
// @route   DELETE /api/posts/:postId/comments/:commentId
// @access  Private
export const deleteComment = asyncHandler(async (req, res) => {
  const { postId, commentId } = req.params;

  const post = await Post.findById(postId);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  const comment = post.comments.id(commentId);

  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'Comment not found',
    });
  }

  // Check ownership
  if (comment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this comment',
    });
  }

  post.comments.pull(commentId);
  await post.save();

  res.status(200).json({
    success: true,
    message: 'Comment deleted successfully',
  });
});

// @desc    Get post categories
// @route   GET /api/posts/categories
// @access  Public
export const getCategories = asyncHandler(async (req, res) => {
  const categories = [
    'General Discussion',
    'Announcements',
    'Wins',
    'Questions',
    'Feedback',
    'Resources & Recommendations',
    'Challenge Check-Ins',
    'Real Talk',
  ];

  // Get post count for each category
  const categoriesWithCounts = await Promise.all(
    categories.map(async (category) => {
      const count = await Post.countDocuments({
        category,
        isApproved: true
      });
      return {
        name: category,
        count,
        slug: category.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and'),
      };
    })
  );

  res.status(200).json({
    success: true,
    data: categoriesWithCounts,
  });
});

// @desc    Pin/unpin post (Admin only)
// @route   PUT /api/posts/:id/pin
// @access  Private (Admin)
export const togglePin = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  post.isPinned = !post.isPinned;
  await post.save();

  res.status(200).json({
    success: true,
    message: post.isPinned ? 'Post pinned' : 'Post unpinned',
    data: { isPinned: post.isPinned },
  });
});