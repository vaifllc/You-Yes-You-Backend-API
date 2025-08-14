import express from 'express';
import multer from 'multer';
import {
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  getUserFiles,
  generateSignedUploadUrl,
} from '../controllers/fileController.js';
import { authenticate } from '../middleware/auth.js';
import { body, param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5, // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    // Allow images, documents, and videos
    const allowedTypes = [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4',
      'video/webm',
      'video/quicktime',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, documents, and videos are allowed.'), false);
    }
  },
});

// All file routes require authentication
router.use(authenticate);

// @desc    Upload single file
// @route   POST /api/files/upload
// @access  Private
router.post('/upload', upload.single('file'), uploadFile);

// @desc    Upload multiple files
// @route   POST /api/files/upload-multiple
// @access  Private
router.post('/upload-multiple', upload.array('files', 5), uploadMultipleFiles);

// @desc    Generate signed upload URL for direct uploads
// @route   POST /api/files/signed-url
// @access  Private
router.post('/signed-url', [
  body('fileName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('File name must be between 1 and 100 characters'),
  body('fileType')
    .isIn([
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'video/mp4', 'video/webm'
    ])
    .withMessage('Invalid file type'),
  handleValidationErrors,
], generateSignedUploadUrl);

// @desc    Get user's files
// @route   GET /api/files/my-files
// @access  Private
router.get('/my-files', getUserFiles);

// @desc    Delete file
// @route   DELETE /api/files/:publicId
// @access  Private
router.delete('/:publicId', [
  param('publicId')
    .notEmpty()
    .withMessage('Public ID is required'),
  handleValidationErrors,
], deleteFile);

export default router;