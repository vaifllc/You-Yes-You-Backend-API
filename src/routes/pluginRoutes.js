import express from 'express';
import {
  getAvailablePlugins,
  installPlugin,
  testPlugin,
  configurePlugin,
  triggerPluginAutomation,
} from '../controllers/pluginController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { body, param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// All plugin routes require admin authentication
router.use(authenticate);

// Plugin automation trigger (can be used by regular users)
router.post('/trigger', [
  body('event')
    .notEmpty()
    .withMessage('Event is required'),
  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object'),
  handleValidationErrors,
], triggerPluginAutomation);

// Admin-only plugin management
router.use(authorize('admin'));

// Get available plugins
router.get('/', getAvailablePlugins);

// Install/activate plugin
router.post('/:pluginId/install', [
  param('pluginId')
    .isAlphanumeric()
    .withMessage('Invalid plugin ID'),
  body('config')
    .optional()
    .isObject()
    .withMessage('Config must be an object'),
  handleValidationErrors,
], installPlugin);

// Test plugin connection
router.post('/:pluginId/test', [
  param('pluginId')
    .isAlphanumeric()
    .withMessage('Invalid plugin ID'),
  body('config')
    .optional()
    .isObject()
    .withMessage('Config must be an object'),
  handleValidationErrors,
], testPlugin);

// Configure plugin settings
router.put('/:pluginId/configure', [
  param('pluginId')
    .isAlphanumeric()
    .withMessage('Invalid plugin ID'),
  body('settings')
    .isObject()
    .withMessage('Settings must be an object'),
  handleValidationErrors,
], configurePlugin);

export default router;