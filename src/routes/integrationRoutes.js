import express from 'express';
import {
  getIntegrations,
  createIntegration,
  updateIntegration,
  testIntegration,
  triggerZapierWebhook,
  getApiKey,
  getExternalUsers,
  getExternalUserCourses,
  getExternalUserEvents,
} from '../controllers/integrationController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  validateObjectId,
  handleValidationErrors,
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// API Key authentication middleware for external endpoints
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers.authorization?.split(' ')[1];
  const validApiKey = process.env.PLATFORM_API_KEY;

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({
      success: false,
      message: 'Invalid API key',
    });
  }

  next();
};

// External API routes (for Zapier and third-party integrations)
router.get('/external/users', authenticateApiKey, getExternalUsers);
router.get('/external/users/:id/courses', authenticateApiKey, validateObjectId, getExternalUserCourses);
router.get('/external/users/:id/events', authenticateApiKey, validateObjectId, getExternalUserEvents);

// Webhook trigger (can be used by authenticated users or external services)
router.post('/zapier/trigger', authenticate, [
  body('event')
    .notEmpty()
    .withMessage('Event is required'),
  body('data')
    .isObject()
    .withMessage('Data must be an object'),
  handleValidationErrors,
], triggerZapierWebhook);

// Admin integration management
router.use(authenticate);
router.use(authorize('admin'));

router.get('/', getIntegrations);
router.get('/api-key', getApiKey);

router.post('/', [
  body('name')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Name must be between 3 and 50 characters'),
  body('type')
    .isIn(['zapier', 'email', 'calendar', 'payment', 'analytics', 'crm', 'lms', 'chatbot', 'social'])
    .withMessage('Invalid integration type'),
  body('provider')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Provider must be between 2 and 50 characters'),
  handleValidationErrors,
], createIntegration);

router.put('/:id', validateObjectId, updateIntegration);
router.post('/:id/test', validateObjectId, testIntegration);

export default router;