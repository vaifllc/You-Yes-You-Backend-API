import express from 'express';
import {
  reportContent,
  getModerationDashboard,
  getReports,
  handleReport,
  analyzeUser,
  bulkModerate,
  getModerationStatistics,
} from '../controllers/moderationController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  validateObjectId,
  validatePagination,
  handleValidationErrors,
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// User reporting routes
router.post('/report', [
  body('contentType')
    .isIn(['post', 'comment', 'message', 'user'])
    .withMessage('Invalid content type'),
  body('contentId')
    .isMongoId()
    .withMessage('Invalid content ID'),
  body('reason')
    .isIn([
      'spam',
      'harassment',
      'hate_speech',
      'inappropriate_content',
      'misinformation',
      'violence',
      'self_harm',
      'illegal_activity',
      'impersonation',
      'copyright',
      'other',
    ])
    .withMessage('Invalid report reason'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('reportedUserId')
    .optional()
    .isMongoId()
    .withMessage('Invalid reported user ID'),
  handleValidationErrors,
], reportContent);

// Admin moderation routes
router.use(authorize('admin'));

router.get('/dashboard', getModerationDashboard);
router.get('/reports', validatePagination, getReports);
router.get('/stats', getModerationStatistics);
router.get('/analyze/:userId', validateObjectId, analyzeUser);

router.put('/reports/:id', [
  validateObjectId,
  body('action')
    .isIn(['dismiss', 'warn_user', 'remove_content', 'suspend_user', 'ban_user', 'escalate'])
    .withMessage('Invalid action'),
  body('reason')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Reason must be between 1 and 500 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  handleValidationErrors,
], handleReport);

router.put('/bulk', [
  body('reportIds')
    .isArray({ min: 1 })
    .withMessage('Report IDs array is required'),
  body('action')
    .isIn(['dismiss', 'resolve'])
    .withMessage('Invalid bulk action'),
  body('reason')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Reason must be between 1 and 200 characters'),
  handleValidationErrors,
], bulkModerate);

export default router;