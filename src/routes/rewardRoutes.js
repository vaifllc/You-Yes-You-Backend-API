import express from 'express';
import {
  getRewards,
  getReward,
  claimReward,
  getUserRewards,
  createReward,
  updateReward,
  getRewardClaims,
} from '../controllers/rewardController.js';
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

// User routes
router.get('/', validatePagination, getRewards);
router.get('/my-rewards', getUserRewards);
router.get('/:id', validateObjectId, getReward);

router.post('/:id/claim', [
  validateObjectId,
  body('shippingAddress')
    .optional()
    .isObject()
    .withMessage('Shipping address must be an object'),
  handleValidationErrors,
], claimReward);

// Admin routes
router.use(authorize('admin'));

router.get('/admin/claims', validatePagination, getRewardClaims);

router.post('/', [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Name must be between 3 and 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('type')
    .isIn(['digital', 'tangible', 'experience'])
    .withMessage('Invalid reward type'),
  body('category')
    .isIn([
      'Course Access',
      'Certificates', 
      'Merchandise',
      'Gift Cards',
      'Books',
      'Coaching',
      'Spotlight',
      'Special Access',
    ])
    .withMessage('Invalid category'),
  body('pointsCost')
    .isInt({ min: 0 })
    .withMessage('Points cost must be a non-negative integer'),
  handleValidationErrors,
], createReward);

router.put('/:id', validateObjectId, updateReward);

export default router;