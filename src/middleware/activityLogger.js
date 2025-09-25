import Activity from '../models/Activity.js';
import { asyncHandler } from './errorHandler.js';

// Generic function to log activity directly
export const directLogActivity = async (userId, type, description, options = {}) => {
  try {
    await Activity.logActivity(userId, type, description, options);
  } catch (error) {
    console.error(`Error logging activity (${type}):`, error);
  }
};

// Middleware for user signup
export const logSignup = asyncHandler(async (userId, req) => {
  await directLogActivity(userId, 'user_signup', 'Signed up for the platform', {
    relatedId: userId,
    relatedType: 'User',
    req,
  });
});

// Middleware for user login
export const logLogin = asyncHandler(async (req, res, next) => {
  // This middleware needs to be placed after authentication and before sending response
  // It will be called directly from authController.js
  next();
});

// Middleware for post creation
export const logPostCreated = asyncHandler(async (req, res, next) => {
  const originalJson = res.json;
  res.json = async function(data) {
    if (data.success && data.data && req.user) {
      await directLogActivity(req.user._id, 'post_created', `Created a new post in ${data.data.category}`, {
        relatedId: data.data._id,
        relatedType: 'Post',
        points: 5,
        req,
      });
    }
    originalJson.call(this, data);
  };
  next();
});

// Middleware for post liking
export const logPostLiked = asyncHandler(async (req, res, next) => {
  const originalJson = res.json;
  res.json = async function(data) {
    if (data.success && data.data && req.user) {
      const action = data.data.isLiked ? 'liked' : 'unliked';
      await directLogActivity(req.user._id, 'post_liked', `${action} a post`, {
        relatedId: req.params.id,
        relatedType: 'Post',
        points: data.data.isLiked ? 1 : 0,
        req,
      });
    }
    originalJson.call(this, data);
  };
  next();
});

// Middleware for post commenting
export const logPostCommented = asyncHandler(async (req, res, next) => {
  const originalJson = res.json;
  res.json = async function(data) {
    if (data.success && data.data && req.user) {
      await directLogActivity(req.user._id, 'comment_created', 'Commented on a post', {
        relatedId: data.data._id,
        relatedType: 'Comment',
        points: 3,
        req,
      });
    }
    originalJson.call(this, data);
  };
  next();
});

// Middleware for course enrollment
export const logCourseEnrolled = asyncHandler(async (req, res, next) => {
  const originalJson = res.json;
  res.json = async function(data) {
    if (data.success && data.data && req.user) {
      const Course = (await import('../models/Course.js')).default;
      const course = await Course.findById(req.params.id);
      await directLogActivity(req.user._id, 'course_enrolled', `Enrolled in course: ${course?.title}`, {
        relatedId: req.params.id,
        relatedType: 'Course',
        points: 10,
        req,
      });
    }
    originalJson.call(this, data);
  };
  next();
});

// Middleware for module completion
export const logModuleCompleted = asyncHandler(async (req, res, next) => {
  const originalJson = res.json;
  res.json = async function(data) {
    if (data.success && data.data && req.user && req.body.completed) {
      const Course = (await import('../models/Course.js')).default;
      const course = await Course.findById(req.params.id);
      await directLogActivity(req.user._id, 'module_completed', `Completed a module in course: ${course?.title}`, {
        relatedId: req.params.id,
        relatedType: 'Course',
        points: 10,
        req,
      });
    }
    originalJson.call(this, data);
  };
  next();
});

// Middleware for event RSVP/joining
export const logEventJoined = asyncHandler(async (req, res, next) => {
  const originalJson = res.json;
  res.json = async function(data) {
    if (data.success && data.data && req.user && req.body.status === 'going') {
      const Event = (await import('../models/Event.js')).default;
      const event = await Event.findById(req.params.id);
      await directLogActivity(req.user._id, 'event_rsvp', `RSVP'd to event: ${event?.title}`, {
        relatedId: req.params.id,
        relatedType: 'Event',
        points: 5,
        req,
      });
    }
    originalJson.call(this, data);
  };
  next();
});