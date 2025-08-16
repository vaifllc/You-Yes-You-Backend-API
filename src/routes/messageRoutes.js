import express from 'express';
import multer from 'multer';
import {
  getConversations,
  getConversationMessages,
  sendMessage,
  sendMessageWithFile,
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

// Configure multer for message file uploads
const messageFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos and files
  },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    const isDocument = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/zip',
      'application/x-zip-compressed'
    ].includes(file.mimetype);

    if (isImage || isVideo || isDocument) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Only images, videos, and documents are permitted.'), false);
    }
  },
});

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

// Send message with file attachment
router.post('/conversations/:id/file', [
  validateObjectId,
  messageFileUpload.single('file'),
  body('content')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Caption must be less than 500 characters'),
  body('type')
    .optional()
    .isIn(['image', 'video', 'file'])
    .withMessage('Invalid file type'),
  handleValidationErrors,
  moderateMessageContent,
  logModerationAction('send_file_message'),
], sendMessageWithFile);

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