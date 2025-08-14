import express from 'express';
import {
  getResources,
  getResource,
  submitResource,
  addResourceReview,
  getResourceCategories,
  getPendingResources,
  moderateResource,
  updateResource,
  deleteResource,
} from '../controllers/resourceController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  validateObjectId,
  validatePagination,
  handleValidationErrors,
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// Public/Member routes
router.use(authenticate);

router.get('/', validatePagination, getResources);
router.get('/categories', getResourceCategories);
router.get('/:id', validateObjectId, getResource);

// Resource submission
router.post('/', [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Description must be between 20 and 2000 characters'),
  body('category')
    .isIn([
      'Housing',
      'Employment',
      'Legal Aid',
      'Mental Health',
      'Financial Services',
      'Education',
      'Healthcare',
      'Transportation',
      'Food Assistance',
      'Childcare',
      'Substance Abuse',
      'Emergency Services',
      'Technology',
      'Other',
    ])
    .withMessage('Invalid category'),
  body('type')
    .isIn(['service', 'organization', 'program', 'tool', 'guide', 'link'])
    .withMessage('Invalid resource type'),
  handleValidationErrors,
], submitResource);

// Reviews
router.post('/:id/reviews', [
  validateObjectId,
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Comment cannot exceed 500 characters'),
  handleValidationErrors,
], addResourceReview);

// Admin routes
router.use(authorize('admin'));

router.get('/admin/pending', validatePagination, getPendingResources);
router.put('/:id/moderate', [
  validateObjectId,
  body('action')
    .isIn(['approve', 'reject'])
    .withMessage('Action must be approve or reject'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Reason cannot exceed 200 characters'),
  handleValidationErrors,
], moderateResource);

router.put('/:id', validateObjectId, updateResource);
router.delete('/:id', validateObjectId, deleteResource);

export default router;