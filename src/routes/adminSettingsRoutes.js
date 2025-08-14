import express from 'express';
import {
  getAllSettings,
  getSettingsByCategory,
  updateSettingsByCategory,
} from '../controllers/adminSettingsController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// All admin settings routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

// Get all settings
router.get('/', getAllSettings);

// Get settings by category
router.get('/:category', [
  param('category')
    .isIn([
      'general',
      'invite',
      'domain',
      'categories',
      'tabs',
      'analytics',
      'gamification',
      'appearance',
      'discovery',
      'links',
      'moderation',
      'about',
    ])
    .withMessage('Invalid settings category'),
  handleValidationErrors,
], getSettingsByCategory);

// Update settings by category
router.put('/:category', [
  param('category')
    .isIn([
      'general',
      'invite',
      'domain',
      'categories',
      'tabs',
      'analytics',
      'gamification',
      'appearance',
      'discovery',
      'links',
      'moderation',
      'about',
    ])
    .withMessage('Invalid settings category'),
  handleValidationErrors,
], updateSettingsByCategory);

export default router;