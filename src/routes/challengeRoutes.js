import express from 'express';
import {
  getChallenges,
  getChallenge,
  joinChallenge,
  updateChallengeProgress,
  getUserChallenges,
  createChallenge,
  updateChallenge,
  deleteChallenge,
  getChallengeLeaderboard,
} from '../controllers/challengeController.js';
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
router.get('/', validatePagination, getChallenges);
router.get('/my-challenges', getUserChallenges);
router.get('/:id', validateObjectId, getChallenge);
router.get('/:id/leaderboard', validateObjectId, getChallengeLeaderboard);

router.post('/:id/join', validateObjectId, joinChallenge);
router.put('/:id/progress', [
  validateObjectId,
  body('taskDay')
    .isInt({ min: 1 })
    .withMessage('Task day must be a positive integer'),
  body('completed')
    .isBoolean()
    .withMessage('Completed must be a boolean'),
  handleValidationErrors,
], updateChallengeProgress);

// Admin routes
router.use(authorize('admin'));

router.post('/', [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  body('type')
    .isIn(['daily', 'weekly', 'monthly', 'custom'])
    .withMessage('Invalid challenge type'),
  body('duration')
    .isInt({ min: 1, max: 365 })
    .withMessage('Duration must be between 1 and 365 days'),
  body('category')
    .isIn(['Personal Development', 'Health & Fitness', 'Financial', 'Family', 'Career', 'Education'])
    .withMessage('Invalid category'),
  body('startDate')
    .isISO8601()
    .withMessage('Invalid start date'),
  body('endDate')
    .isISO8601()
    .withMessage('Invalid end date'),
  handleValidationErrors,
], createChallenge);

router.put('/:id', validateObjectId, updateChallenge);
router.delete('/:id', validateObjectId, deleteChallenge);

export default router;