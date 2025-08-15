import express from 'express';
import {
  reportContent,
  getModerationDashboard,
  getReports,
  handleReport,
  analyzeUser,
  bulkModerate,
  autoModerate,
  getModerationStatistics,
  getModerationInsights,
} from '../controllers/moderationController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  validateObjectId,
  validatePagination,
  handleValidationErrors,
} from '../middleware/validation.js';
import { body, query } from 'express-validator';

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
      'hate_speech',
      'violence',
      'harassment',
      'spam',
      'inappropriate_content',
      'personal_information',
      'copyright',
      'misinformation',
      'self_harm',
      'illegal_activity',
      'other'
    ])
    .withMessage('Invalid report reason'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
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
router.get('/reports', [
  validatePagination,
  query('status').optional().isIn(['pending', 'resolved', 'dismissed', 'escalated', 'all']).withMessage('Invalid status filter'),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent', 'all']).withMessage('Invalid priority filter'),
  query('contentType').optional().isIn(['post', 'comment', 'message', 'user', 'all']).withMessage('Invalid content type filter'),
  query('reason').optional().isString().withMessage('Invalid reason filter'),
  query('severity').optional().isIn(['low', 'medium', 'high', 'critical', 'all']).withMessage('Invalid severity filter'),
  query('dateFrom').optional().isISO8601().withMessage('Invalid date format for dateFrom'),
  query('dateTo').optional().isISO8601().withMessage('Invalid date format for dateTo'),
  query('reportedUser').optional().isMongoId().withMessage('Invalid reported user ID'),
  query('autoModerated').optional().isBoolean().withMessage('Invalid autoModerated filter'),
  query('sortBy').optional().isIn(['createdAt', 'priority', 'status', 'severity']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Invalid sort order'),
  handleValidationErrors,
], getReports);

router.get('/stats', [
  query('timeframe').optional().isIn(['24h', '7d', '30d', '90d', '1y']).withMessage('Invalid timeframe'),
  query('groupBy').optional().isIn(['hour', 'day', 'week', 'month']).withMessage('Invalid groupBy parameter'),
  handleValidationErrors,
], getModerationStatistics);

router.get('/insights', [
  query('timeframe').optional().isIn(['7d', '30d', '90d']).withMessage('Invalid timeframe'),
  handleValidationErrors,
], getModerationInsights);

router.get('/analyze/:userId', validateObjectId, analyzeUser);

router.put('/reports/:id', [
  validateObjectId,
  body('action')
    .isIn([
      'dismiss',
      'warn_user',
      'remove_content',
      'suspend_user',
      'ban_user',
      'shadow_ban',
      'restrict_posting',
      'require_approval',
      'escalate',
      'mark_spam',
      'educational_intervention',
      'custom'
    ])
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
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
  body('duration')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Duration must be between 1 and 365 days'),
  body('customAction')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Custom action must be between 1 and 200 characters'),
  handleValidationErrors,
], handleReport);

router.put('/bulk', [
  body('reportIds')
    .isArray({ min: 1, max: 50 })
    .withMessage('Report IDs array is required (1-50 items)'),
  body('action')
    .isIn(['dismiss', 'resolve', 'escalate'])
    .withMessage('Invalid bulk action'),
  body('reason')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Reason must be between 1 and 200 characters'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
  body('duration')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Duration must be between 1 and 365 days'),
  handleValidationErrors,
], bulkModerate);

// Auto-moderation route
router.post('/auto-moderate', [
  body('contentIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Content IDs array is required (1-100 items)'),
  body('contentType')
    .optional()
    .isIn(['post', 'message'])
    .withMessage('Invalid content type'),
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
  body('options.strictMode')
    .optional()
    .isBoolean()
    .withMessage('strictMode must be a boolean'),
  body('options.contextAware')
    .optional()
    .isBoolean()
    .withMessage('contextAware must be a boolean'),
  body('options.personalInfoCheck')
    .optional()
    .isBoolean()
    .withMessage('personalInfoCheck must be a boolean'),
  body('options.spamCheck')
    .optional()
    .isBoolean()
    .withMessage('spamCheck must be a boolean'),
  handleValidationErrors,
], autoModerate);

export default router;