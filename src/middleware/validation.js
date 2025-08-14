import { body, param, query, validationResult } from 'express-validator';

// Helper function to handle validation results
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value,
      })),
    });
  }
  
  next();
};

// User validation rules
export const validateUserRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores')
    .toLowerCase(),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location cannot exceed 100 characters'),
  
  handleValidationErrors,
];

export const validateUserLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors,
];

export const validateUserUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location cannot exceed 100 characters'),
  
  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array')
    .custom((skills) => {
      if (skills.length > 20) {
        throw new Error('Cannot have more than 20 skills');
      }
      return true;
    }),
  
  handleValidationErrors,
];

// Post validation rules
export const validatePost = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Post content must be between 1 and 5000 characters'),
  
  body('category')
    .isIn([
      'General Discussion',
      'Announcements',
      'Wins',
      'Questions',
      'Feedback',
      'Resources & Recommendations',
      'Challenge Check-Ins',
      'Real Talk',
    ])
    .withMessage('Invalid post category'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => {
      if (tags.length > 10) {
        throw new Error('Cannot have more than 10 tags');
      }
      return true;
    }),
  
  handleValidationErrors,
];

export const validateComment = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters'),
  
  handleValidationErrors,
];

// Event validation rules
export const validateEvent = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Event title must be between 5 and 200 characters'),
  
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Event description must be between 10 and 2000 characters'),
  
  body('date')
    .isISO8601()
    .withMessage('Invalid date format')
    .custom((date) => {
      if (new Date(date) < new Date()) {
        throw new Error('Event date cannot be in the past');
      }
      return true;
    }),
  
  body('duration')
    .matches(/^\d+\s(min|mins|hour|hours)$/)
    .withMessage('Duration must be in format "60 min" or "2 hours"'),
  
  body('type')
    .isIn(['workshop', 'qa', 'onboarding', 'mentorship', 'community', 'guest'])
    .withMessage('Invalid event type'),
  
  body('maxAttendees')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Max attendees must be between 1 and 1000'),
  
  handleValidationErrors,
];

// Course validation rules
export const validateCourse = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Course title must be between 5 and 200 characters'),
  
  body('description')
    .trim()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Course description must be between 20 and 2000 characters'),
  
  body('category')
    .isIn(['Personal Development', 'Financial Literacy', 'Entrepreneurship', 'Life Skills'])
    .withMessage('Invalid course category'),
  
  body('phase')
    .isIn(['Phase 1', 'Phase 2', 'Phase 3'])
    .withMessage('Invalid course phase'),
  
  body('level')
    .isIn(['Beginner', 'Intermediate', 'Advanced'])
    .withMessage('Invalid course level'),
  
  body('instructor')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Instructor name must be between 2 and 100 characters'),
  
  handleValidationErrors,
];

// Parameter validation
export const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  
  handleValidationErrors,
];

// Query validation
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors,
];

export const validateLeaderboardQuery = [
  query('timeframe')
    .optional()
    .isIn(['weekly', 'monthly', 'all-time'])
    .withMessage('Invalid timeframe. Must be weekly, monthly, or all-time'),
  
  query('phase')
    .optional()
    .isIn(['Phase 1', 'Phase 2', 'Phase 3'])
    .withMessage('Invalid phase'),
  
  validatePagination,
];