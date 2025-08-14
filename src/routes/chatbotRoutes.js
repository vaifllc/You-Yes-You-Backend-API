import express from 'express';
import {
  handleChatbotMessage,
  getChatbotTopics,
  getChatbotHistory,
} from '../controllers/chatbotController.js';
import { authenticate } from '../middleware/auth.js';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// All chatbot routes require authentication
router.use(authenticate);

// @desc    Send message to chatbot
// @route   POST /api/chatbot/message
// @access  Private
router.post('/message', [
  body('message')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Message must be between 1 and 500 characters'),
  body('conversationId')
    .optional()
    .isString()
    .withMessage('Conversation ID must be a string'),
  handleValidationErrors,
], handleChatbotMessage);

// @desc    Get available help topics
// @route   GET /api/chatbot/topics
// @access  Private
router.get('/topics', getChatbotTopics);

// @desc    Get chatbot conversation history
// @route   GET /api/chatbot/history
// @access  Private
router.get('/history', getChatbotHistory);

export default router;