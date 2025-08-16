import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { body, param } from 'express-validator';
import { handleValidationErrors, validateObjectId } from '../middleware/validation.js';
import Achievement from '../models/Achievement.js';
import User from '../models/User.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

// Create achievement
router.post('/', [
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('points').optional().isInt({ min: 0 }),
  body('icon').optional().isString(),
  body('category').optional().isIn(['Engagement', 'Learning', 'Community', 'Achievement', 'Streak', 'Special']),
  handleValidationErrors,
], asyncHandler(async (req, res) => {
  const ach = await Achievement.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, data: ach });
}));

// List achievements
router.get('/', asyncHandler(async (req, res) => {
  const list = await Achievement.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: list });
}));

// Update achievement
router.put('/:id', [validateObjectId], asyncHandler(async (req, res) => {
  const ach = await Achievement.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!ach) return res.status(404).json({ success: false, message: 'Achievement not found' });
  res.status(200).json({ success: true, data: ach });
}));

// Delete achievement
router.delete('/:id', [validateObjectId], asyncHandler(async (req, res) => {
  const ach = await Achievement.findById(req.params.id);
  if (!ach) return res.status(404).json({ success: false, message: 'Achievement not found' });
  await Achievement.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Achievement deleted' });
}));

// Assign to user
router.post('/:id/assign/:userId', [validateObjectId, param('userId').isMongoId()], asyncHandler(async (req, res) => {
  const ach = await Achievement.findById(req.params.id);
  if (!ach) return res.status(404).json({ success: false, message: 'Achievement not found' });
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  user.achievements.push({ title: ach.name, description: ach.description, icon: ach.icon, earnedAt: new Date() });
  // Optionally add points
  if (ach.points && ach.points > 0) {
    user.points += ach.points;
    user.updateLevel();
  }
  await user.save();
  res.status(200).json({ success: true, message: 'Achievement assigned', data: user.achievements[user.achievements.length - 1] });
}));

export default router;


