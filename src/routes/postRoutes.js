import express from 'express';
import {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  toggleBookmark,
  addComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
  getCategories,
  togglePin,
} from '../controllers/postController.js';
import { authenticate, authorize, optionalAuth, checkOwnership } from '../middleware/auth.js';
import {
  moderatePostContent,
  moderateCommentContent,
  checkUserStatus,
  logModerationAction
} from '../middleware/moderation.js';
import {
  validatePost,
  validateComment,
  validateObjectId,
  validatePagination,
  handleValidationErrors,
} from '../middleware/validation.js';
import { param } from 'express-validator';

const router = express.Router();

// Public routes
router.get('/', optionalAuth, validatePagination, getPosts);
router.get('/categories', getCategories);
router.get('/:id', validateObjectId, optionalAuth, getPost);

// Protected routes
router.use(authenticate);
router.use(checkOwnership());
router.use(checkUserStatus); // Check if user is banned/suspended

router.post('/', validatePost, moderatePostContent, logModerationAction('create_post'), createPost);
router.put('/:id', validateObjectId, validatePost, moderatePostContent, logModerationAction('update_post'), updatePost);
router.delete('/:id', validateObjectId, deletePost);
router.put('/:id/like', toggleLike);
router.put('/:id/bookmark', toggleBookmark);

// Comment routes
router.post('/:id/comments', validateObjectId, validateComment, moderateCommentContent, logModerationAction('create_comment'), addComment);
router.put('/:postId/comments/:commentId', [
  param('postId').isMongoId().withMessage('Invalid post ID'),
  param('commentId').isMongoId().withMessage('Invalid comment ID'),
  ...validateComment,
  handleValidationErrors,
  moderateCommentContent,
  logModerationAction('update_comment'),
], updateComment);
router.delete('/:postId/comments/:commentId', [
  param('postId').isMongoId().withMessage('Invalid post ID'),
  param('commentId').isMongoId().withMessage('Invalid comment ID'),
  handleValidationErrors,
], deleteComment);
router.put('/:postId/comments/:commentId/like', [
  param('postId').isMongoId().withMessage('Invalid post ID'),
  param('commentId').isMongoId().withMessage('Invalid comment ID'),
  handleValidationErrors,
], toggleCommentLike);

// Admin only routes
router.put('/:id/pin', validateObjectId, authorize('admin'), togglePin);

export default router;