import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/generateToken.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { updateStreak, STREAK_TYPES } from '../utils/streakTracker.js';
import { sendWelcomeMessage } from '../utils/autoMessaging.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// Generate JWT moved to utils

// Send token response
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  const userResponse = {
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    location: user.location,
    phase: user.phase,
    skills: user.skills,
    joinDate: user.joinDate,
    points: user.points,
    level: user.level,
    role: user.role,
    isOnline: user.isOnline,
    achievements: user.achievements,
  };

  res.status(statusCode).json({
    success: true,
    message,
    token,
    refreshToken,
    user: userResponse,
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const register = asyncHandler(async (req, res) => {
  const { name, username, email, password, bio, location } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    const field = existingUser.email === email ? 'email' : 'username';
    return res.status(400).json({
      success: false,
      message: `A user with this ${field} already exists`,
    });
  }

  // Create user
  const user = await User.create({
    name,
    username,
    email,
    password,
    bio: bio || '',
    location: location || '',
  });

  // Award points for joining
  await user.addPoints(10, 'Account registration');

  // Send welcome notification
  await Notification.sendWelcomeMessage(user._id);

  // Send welcome message via auto-messaging system
  await sendWelcomeMessage(user._id);

  // Trigger webhook for new member (async, non-blocking)
  setTimeout(async () => {
    try {
      await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhooks/zapier/new_member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.PLATFORM_API_KEY,
        },
        body: JSON.stringify({
          userId: user._id,
          name: user.name,
          email: user.email,
          phase: user.phase,
          joinDate: user.joinDate,
        }),
      });
    } catch (error) {
      console.log('Webhook trigger failed:', error.message);
    }
  }, 1000);

  sendTokenResponse(user, 201, res, 'User registered successfully');
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user by email and include password
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
    });
  }

  // Check password
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
    });
  }

  // Update login streak and award points for daily login
  const today = new Date().toDateString();
  const lastLogin = user.lastActive ? user.lastActive.toDateString() : null;

  if (lastLogin !== today) {
    await user.addPoints(2, 'Daily login');
    await updateStreak(user._id, STREAK_TYPES.LOGIN);
  }

  // Update online status
  user.isOnline = true;
  user.lastActive = new Date();
  await user.save();

  sendTokenResponse(user, 200, res, 'Login successful');
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res) => {
  const user = req.user;

  res.status(200).json({
    success: true,
    user: {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      location: user.location,
      phase: user.phase,
      skills: user.skills,
      joinDate: user.joinDate,
      points: user.points,
      level: user.level,
      role: user.role,
      isOnline: user.isOnline,
      achievements: user.achievements,
      courses: user.courses,
      pointsHistory: user.pointsHistory.slice(-10), // Last 10 activities
    },
  });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, bio, location, skills, avatar } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Update fields
  if (name) user.name = name;
  if (bio !== undefined) user.bio = bio;
  if (location !== undefined) user.location = location;
  if (skills) user.skills = skills;
  if (avatar) user.avatar = avatar;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    user: {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      location: user.location,
      phase: user.phase,
      skills: user.skills,
      joinDate: user.joinDate,
      points: user.points,
      level: user.level,
      role: user.role,
      isOnline: user.isOnline,
      achievements: user.achievements,
    },
  });
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = asyncHandler(async (req, res) => {
  // Update user online status
  const user = await User.findById(req.user._id);
  if (user) {
    user.isOnline = false;
    user.lastActive = new Date();
    await user.save();
  }

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  // Check current password
  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect',
    });
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});