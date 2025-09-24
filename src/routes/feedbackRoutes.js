import express from 'express';
import {
  getFeedback,
  getFeedbackById,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  addResponse,
  toggleFlag,
  toggleBookmark,
  getFeedbackStats,
  getUserFeedback,
  getFeedbackByCategory,
  getUserFeedbackStats,
  searchFeedback,
  getPopularFeedback,
  moderateFeedback,
  assignFeedback,
  bulkModerateFeedback
} from '../controllers/feedbackController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { moderateContentMiddleware } from '../middleware/moderation.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Public feedback routes (authenticated users)
router.get('/', getFeedback);
router.get('/stats/overview', getFeedbackStats);
router.get('/user/:userId', getUserFeedback);
router.get('/category/:category', getFeedbackByCategory);
router.get('/stats/user', getUserFeedbackStats);
router.get('/search', searchFeedback);
router.get('/popular', getPopularFeedback);
router.get('/:id', getFeedbackById);

// Feedback CRUD operations
router.post('/', moderateContentMiddleware('description'), createFeedback);
router.put('/:id', moderateContentMiddleware('description'), updateFeedback);
router.delete('/:id', deleteFeedback);

// Feedback interactions
router.post('/:id/responses', moderateContentMiddleware('content'), addResponse);
router.post('/:id/flag', toggleFlag);
router.post('/:id/bookmark', toggleBookmark);

// Admin-only routes
router.put('/:id/moderate', authorize('admin'), moderateFeedback);
router.put('/:id/assign', authorize('admin'), assignFeedback);
router.put('/bulk/moderate', authorize('admin'), bulkModerateFeedback);

export default router;
