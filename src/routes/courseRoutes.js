import express from 'express';
import Course from '../models/Course.js';
import User from '../models/User.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  validateCourse,
  validateObjectId,
  validatePagination,
  handleValidationErrors,
} from '../middleware/validation.js';
import { param } from 'express-validator';

const router = express.Router();

// @desc    Get all courses
// @route   GET /api/courses
// @access  Public
router.get('/', optionalAuth, validatePagination, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    category,
    phase,
    level,
    search,
    sortBy = 'popular'
  } = req.query;

  // Build query
  const query = { isPublished: true };

  if (category && category !== 'all') {
    query.category = category;
  }

  if (phase && phase !== 'all') {
    query.phase = phase;
  }

  if (level && level !== 'all') {
    query.level = level;
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { instructor: { $regex: search, $options: 'i' } },
      { skills: { $in: [new RegExp(search, 'i')] } },
    ];
  }

  // Build sort object
  let sort = {};
  switch (sortBy) {
    case 'popular':
      sort = { enrollmentCount: -1 };
      break;
    case 'rating':
      sort = { 'rating.average': -1 };
      break;
    case 'newest':
      sort = { createdAt: -1 };
      break;
    case 'alphabetical':
      sort = { title: 1 };
      break;
    default:
      sort = { enrollmentCount: -1 };
  }

  // Execute query with pagination
  const courses = await Course.find(query)
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Add enrollment status for authenticated users
  if (req.user) {
    courses.forEach(course => {
      course.isEnrolled = req.user.courses.some(
        userCourse => userCourse.courseId.toString() === course._id.toString()
      );

      const userCourse = req.user.courses.find(
        uc => uc.courseId.toString() === course._id.toString()
      );
      course.userProgress = userCourse ? userCourse.progress : 0;
    });
  }

  // Get total count for pagination
  const total = await Course.countDocuments(query);

  res.status(200).json({
    success: true,
    data: courses,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
}));

// NOTE: Place static routes BEFORE parameterized ones to avoid collisions (e.g., /my-courses vs /:id)

// @desc    Enroll in course
// @route   POST /api/courses/:id/enroll
// @access  Private
router.post('/:id/enroll', authenticate, validateObjectId, asyncHandler(async (req, res) => {
  const courseId = req.params.id;
  const userId = req.user._id;

  const course = await Course.findById(courseId);

  if (!course || !course.isPublished) {
    return res.status(404).json({
      success: false,
      message: 'Course not found or not available',
    });
  }

  const user = await User.findById(userId);

  // Check if already enrolled
  const existingEnrollment = user.courses.find(
    uc => uc.courseId.toString() === courseId
  );

  if (existingEnrollment) {
    return res.status(400).json({
      success: false,
      message: 'Already enrolled in this course',
    });
  }

  // Add course to user's courses
  user.courses.push({
    courseId,
    enrolledAt: new Date(),
    progress: 0,
    completedModules: [],
  });

  await user.save();

  // Update course enrollment count
  course.enrollmentCount += 1;
  await course.save();

  // Award points for enrollment
  await user.addPoints(10, `Enrolled in ${course.title}`);

  res.status(200).json({
    success: true,
    message: 'Successfully enrolled in course',
    data: {
      courseId,
      enrolledAt: new Date(),
      progress: 0,
    },
  });
}));

// @desc    Update course progress
// @route   PUT /api/courses/:id/progress
// @access  Private
router.put('/:id/progress', authenticate, validateObjectId, asyncHandler(async (req, res) => {
  const { moduleId, completed, progress } = req.body;
  const courseId = req.params.id;
  const userId = req.user._id;

  const course = await Course.findById(courseId);

  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found',
    });
  }

  const user = await User.findById(userId);
  const userCourse = user.courses.find(
    uc => uc.courseId.toString() === courseId
  );

  if (!userCourse) {
    return res.status(400).json({
      success: false,
      message: 'Not enrolled in this course',
    });
  }

  // Update module completion
  if (moduleId && completed) {
    if (!userCourse.completedModules.includes(moduleId)) {
      userCourse.completedModules.push(moduleId);

      // Award points for module completion
      await user.addPoints(10, `Completed module in ${course.title}`);
    }
  }

  // Update overall progress
  if (progress !== undefined) {
    userCourse.progress = Math.min(100, Math.max(0, progress));

    // Award points for course completion (only when crossing to 100)
    if (progress !== undefined && userCourse.progress < 100 && Math.min(100, Math.max(0, progress)) === 100) {
      await user.addPoints(50, `Completed course: ${course.title}`);
    }
  }

  userCourse.lastAccessed = new Date();
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Progress updated successfully',
    data: {
      progress: userCourse.progress,
      completedModules: userCourse.completedModules,
    },
  });
}));

// @desc    Get user's enrolled courses
// @route   GET /api/courses/my-courses
// @access  Private
router.get('/my-courses', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('courses.courseId');

  const enrolledCourses = user.courses.map(userCourse => ({
    ...userCourse.courseId.toJSON(),
    enrolledAt: userCourse.enrolledAt,
    progress: userCourse.progress,
    completedModules: userCourse.completedModules,
    lastAccessed: userCourse.lastAccessed,
  }));

  res.status(200).json({
    success: true,
    data: enrolledCourses,
  });
}));

// @desc    Get course module
// @route   GET /api/courses/:courseId/modules/:moduleId
// @access  Private
// @desc    Get course module
// (kept before /:id to avoid conflicts and ensure specific route matching)
router.get('/:courseId/modules/:moduleId',
  authenticate,
  [
    param('courseId').isMongoId().withMessage('Invalid course ID'),
    param('moduleId').isMongoId().withMessage('Invalid module ID'),
    handleValidationErrors,
  ],
  asyncHandler(async (req, res) => {
    const { courseId, moduleId } = req.params;

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Check if user is enrolled
    const userCourse = req.user.courses.find(
      uc => uc.courseId.toString() === courseId
    );

    if (!userCourse) {
      return res.status(403).json({
        success: false,
        message: 'Must be enrolled to access course content',
      });
    }

    const module = course.modules.id(moduleId);

    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Module not found',
      });
    }

    // Check if module is completed
    const isCompleted = userCourse.completedModules.includes(moduleId);

    res.status(200).json({
      success: true,
      data: {
        ...module.toJSON(),
        isCompleted,
      },
    });
  })
);

// @desc    Get single course
// @route   GET /api/courses/:id
// @access  Public
router.get('/:id', validateObjectId, optionalAuth, asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found',
    });
  }

  // Check if user is enrolled
  let isEnrolled = false;
  let userProgress = 0;
  let completedModules = [];

  if (req.user) {
    const userCourse = req.user.courses.find(
      uc => uc.courseId.toString() === course._id.toString()
    );

    if (userCourse) {
      isEnrolled = true;
      userProgress = userCourse.progress;
      completedModules = userCourse.completedModules;
    }
  }

  res.status(200).json({
    success: true,
    data: {
      ...course.toJSON(),
      isEnrolled,
      userProgress,
      completedModules,
    },
  });
}));

// Admin routes for course management
router.use(authorize('admin'));

// @desc    Create new course
// @route   POST /api/courses
// @access  Private (Admin)
router.post('/', validateCourse, asyncHandler(async (req, res) => {
  const course = await Course.create(req.body);

  res.status(201).json({
    success: true,
    message: 'Course created successfully',
    data: course,
  });
}));

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private (Admin)
router.put('/:id', validateObjectId, validateCourse, asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Course updated successfully',
    data: course,
  });
}));

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private (Admin)
router.delete('/:id', validateObjectId, asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found',
    });
  }

  await Course.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Course deleted successfully',
  });
}));

export default router;