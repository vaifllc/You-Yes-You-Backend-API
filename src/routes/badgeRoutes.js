import express from 'express';
import {
  getBadges,
  getUserBadges,
  checkBadgeEligibility,
  createBadge,
  updateBadge,
  deleteBadge,
  awardBadge,
} from '../controllers/badgeController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  validateObjectId,
  handleValidationErrors,
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// User routes
router.get('/', getBadges);
router.get('/my-badges', getUserBadges);
router.post('/check-eligibility', checkBadgeEligibility);

// Admin routes
router.use(authorize('admin'));

router.post('/', [
  body('name')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Name must be between 3 and 50 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Description must be between 10 and 200 characters'),
  body('icon')
    .notEmpty()
    .withMessage('Icon is required'),
  body('category')
    .isIn(['Engagement', 'Learning', 'Community', 'Achievement', 'Streak', 'Special'])
    .withMessage('Invalid category'),
  body('criteria.type')
    .isIn(['points', 'posts', 'comments', 'courses', 'events', 'streak', 'custom'])
    .withMessage('Invalid criteria type'),
  body('criteria.value')
    .isInt({ min: 1 })
    .withMessage('Criteria value must be a positive integer'),
  handleValidationErrors,
], createBadge);

router.put('/:id', validateObjectId, updateBadge);
router.delete('/:id', validateObjectId, deleteBadge);

router.post('/:id/award', [
  validateObjectId,
  body('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
  handleValidationErrors,
], awardBadge);

export default router;