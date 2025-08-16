import express from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
} from '../controllers/fileController.js';

const router = express.Router();

// Configure multer specifically for legacy avatar/image uploads
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// General upload (images and videos)
const generalUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit to allow longer recordings
  },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    if (isImage || isVideo) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  },
});

// @desc    Upload avatar image
// @route   POST /api/upload/avatar
// @access  Private
router.post('/avatar', authenticate, avatarUpload.single('avatar'), asyncHandler(async (req, res) => {
  // Use the new file controller for avatar uploads
  await uploadFile(req, res);

  // Update user avatar if upload was successful
  if (req.file) {
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(req.user._id);
    user.avatar = res.locals.uploadedFile?.url || req.body.avatarUrl;
    await user.save();
  }
}));

// @desc    General single file upload (images/videos)
// @route   POST /api/upload/single
// @access  Private
router.post('/single', authenticate, generalUpload.single('file'), uploadFile);

// @desc    Upload post images
// @route   POST /api/upload/post-images
// @access  Private
router.post('/post-images', authenticate, avatarUpload.array('images', 5), uploadMultipleFiles);

// @desc    Delete image from Cloudinary
// @route   DELETE /api/upload/:publicId
// @access  Private
router.delete('/:publicId', authenticate, deleteFile);

export default router;