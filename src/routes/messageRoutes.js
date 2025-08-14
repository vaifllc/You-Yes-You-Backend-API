import express from 'express';
import {
  getConversations,
  getConversationMessages,
  sendMessage,
  startConversation,
  deleteMessage,
  editMessage,
  markConversationAsRead,
  addReaction,
  getMessageHistory,
} from '../controllers/messageController.js';
import { authenticate } from '../middleware/auth.js';
import { moderateMessageContent, checkUserStatus, logModerationAction } from '../middleware/moderation.js';
import {
  validateObjectId,
  validatePagination,
  handleValidationErrors,
} from '../middleware/validation.js';
import { body, param } from 'express-validator';

const router = express.Router();

// All message routes require authentication
router.use(authenticate);
router.use(checkUserStatus); // Check if user is banned/suspended

// Conversation routes
router.get('/conversations', validatePagination, getConversations);
router.get('/conversations/:id', validateObjectId, getConversationMessages);
router.put('/conversations/:id/read', validateObjectId, markConversationAsRead);

// Start new conversation
router.post('/conversations', [
  body('recipientId')
    .isMongoId()
    .withMessage('Invalid recipient ID'),
  body('initialMessage')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  handleValidationErrors,
], startConversation);

// Send message
router.post('/conversations/:id', [
  validateObjectId,
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  body('type')
    .optional()
    .isIn(['text', 'image', 'file'])
    .withMessage('Invalid message type'),
  body('replyTo')
    .optional()
    .isMongoId()
    .withMessage('Invalid reply message ID'),
  handleValidationErrors,
  moderateMessageContent,
  logModerationAction('send_message'),
], sendMessage);

// Message management
router.put('/:id', [
  validateObjectId,
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  handleValidationErrors,
  moderateMessageContent,
  logModerationAction('edit_message'),
], editMessage);

router.delete('/:id', validateObjectId, deleteMessage);

// Message reactions
router.post('/:id/reactions', [
  validateObjectId,
  body('emoji')
    .isString()
    .isLength({ min: 1, max: 10 })
    .withMessage('Emoji is required'),
  handleValidationErrors,
], addReaction);

// Conversation history (before a timestamp)
router.get('/conversations/:id/history', validateObjectId, getMessageHistory);

export default router;