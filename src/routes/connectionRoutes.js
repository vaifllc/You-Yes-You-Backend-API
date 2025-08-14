import express from 'express';
import {
  sendConnectionRequest,
  respondToConnectionRequest,
  getUserConnections,
  getPendingConnectionRequests,
  cancelConnectionRequest,
  blockConnection,
  getConnectionTemplates,
  getConnectionStats,
} from '../controllers/connectionController.js';
import { authenticate } from '../middleware/auth.js';
import {
  validateObjectId,
  validatePagination,
  handleValidationErrors,
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// All connection routes require authentication
router.use(authenticate);

// Get connection templates
router.get('/templates', getConnectionTemplates);

// Get user's connection stats
router.get('/stats', getConnectionStats);

// Get user's connections
router.get('/', validatePagination, getUserConnections);

// Get pending requests
router.get('/pending', getPendingConnectionRequests);

// Send connection request
router.post('/request', [
  body('recipientId')
    .isMongoId()
    .withMessage('Invalid recipient ID'),
  body('type')
    .isIn(['brotherhood', 'mentorship', 'accountability'])
    .withMessage('Invalid connection type'),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Message cannot exceed 500 characters'),
  body('template')
    .optional()
    .isIn(['brotherhood', 'mentorship', 'accountability', 'custom'])
    .withMessage('Invalid template type'),
  handleValidationErrors,
], sendConnectionRequest);

// Respond to connection request
router.put('/:id/respond', [
  validateObjectId,
  body('action')
    .isIn(['accept', 'decline'])
    .withMessage('Action must be accept or decline'),
  handleValidationErrors,
], respondToConnectionRequest);

// Block connection
router.put('/:id/block', validateObjectId, blockConnection);

// Cancel connection request
router.delete('/:id', validateObjectId, cancelConnectionRequest);

export default router;