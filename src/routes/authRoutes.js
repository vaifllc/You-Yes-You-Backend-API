import express from 'express';
import {
  register,
  login,
  getMe,
  updateProfile,
  logout,
  changePassword,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import {
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  handleValidationErrors,
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// Public routes
router.post('/register', validateUserRegistration, register);
router.post('/login', validateUserLogin, login);

// Protected routes
router.use(authenticate); // All routes after this middleware require authentication

router.get('/me', getMe);
router.put('/profile', validateUserUpdate, updateProfile);
router.post('/logout', logout);
router.put('/password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
  handleValidationErrors,
], changePassword);

export default router;