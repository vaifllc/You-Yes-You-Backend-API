export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Avoid noisy logs for 404s and client errors
  const status = error.statusCode || res.statusCode || 500;
  if (status >= 500) {
    console.error('Error:', err);
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = {
      message,
      statusCode: 404,
    };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    let message;
    const field = Object.keys(err.keyValue)[0];

    switch (field) {
      case 'email':
        message = 'An account with this email already exists';
        break;
      case 'username':
        message = 'This username is already taken';
        break;
      default:
        message = 'Duplicate field value entered';
    }

    error = {
      message,
      statusCode: 400,
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      message,
      statusCode: 400,
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Invalid token',
      statusCode: 401,
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token expired',
      statusCode: 401,
    };
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      message: 'File too large',
      statusCode: 400,
    };
  }

  // Default error response
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFound = (req, res, next) => {
  // Quietly handle common bot scanner paths (e.g., .php/.aspx)
  const noisy = /(\.php|\.asp|\.aspx|\.env|wp-admin|wp-login|\.git)/i.test(req.originalUrl);
  if (noisy) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  return res.status(404).json({
    success: false,
    message: `Not found - ${req.originalUrl}`,
  });
};

// Async error handler wrapper
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};