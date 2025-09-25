import Activity from '../models/Activity.js';

// Middleware to log user activities
export const logActivity = (type, descriptionFn, options = {}) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json;

    // Override res.json to capture successful responses
    res.json = function(body) {
      // Only log if request was successful
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const description = typeof descriptionFn === 'function'
          ? descriptionFn(req, res, body)
          : descriptionFn;

        // Log activity asynchronously (don't block response)
        setImmediate(() => {
          Activity.logActivity(req.user._id, type, description, {
            ...options,
            req,
            metadata: {
              ...options.metadata,
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              responseData: options.includeResponseData ? body : undefined
            }
          }).catch(error => {
            console.error('Failed to log activity:', error);
          });
        });
      }

      // Call original json method
      return originalJson.call(this, body);
    };

    next();
  };
};

// Specific activity loggers
export const logLogin = logActivity('login', 'User logged in');
export const logLogout = logActivity('logout', 'User logged out');

export const logPostCreated = logActivity(
  'post_created',
  (req) => `Created a new post in ${req.body.category}`,
  {
    relatedType: 'post',
    points: 5
  }
);

export const logPostLiked = logActivity(
  'post_liked',
  'Liked a post',
  {
    relatedType: 'post',
    points: 1
  }
);

export const logPostCommented = logActivity(
  'post_commented',
  'Commented on a post',
  {
    relatedType: 'comment',
    points: 3
  }
);

export const logCourseEnrolled = logActivity(
  'course_enrolled',
  (req) => `Enrolled in course: ${req.body.title || 'Unknown'}`,
  {
    relatedType: 'course',
    points: 10
  }
);

export const logCourseCompleted = logActivity(
  'course_completed',
  (req) => `Completed course: ${req.body.title || 'Unknown'}`,
  {
    relatedType: 'course',
    points: 50
  }
);

export const logModuleCompleted = logActivity(
  'module_completed',
  (req) => `Completed a course module`,
  {
    relatedType: 'course',
    points: 10
  }
);

export const logEventJoined = logActivity(
  'event_joined',
  (req) => `RSVP'd to an event`,
  {
    relatedType: 'event',
    points: 5
  }
);

export const logEventAttended = logActivity(
  'event_attended',
  (req) => `Attended an event`,
  {
    relatedType: 'event',
    points: 15
  }
);

export const logChallengeJoined = logActivity(
  'challenge_joined',
  (req) => `Joined a challenge`,
  {
    relatedType: 'challenge',
    points: 5
  }
);

export const logChallengeCompleted = logActivity(
  'challenge_completed',
  (req) => `Completed a challenge`,
  {
    relatedType: 'challenge',
    points: 25
  }
);

export const logProfileUpdated = logActivity(
  'profile_updated',
  'Updated profile information'
);

export const logPasswordChanged = logActivity(
  'password_changed',
  'Changed account password'
);

export const logEmailVerified = logActivity(
  'email_verified',
  'Verified email address'
);

export const logFeedbackSubmitted = logActivity(
  'feedback_submitted',
  (req) => `Submitted feedback: ${req.body.category || 'General'}`,
  {
    relatedType: 'feedback'
  }
);

export const logReportSubmitted = logActivity(
  'report_submitted',
  (req) => `Reported ${req.body.contentType}: ${req.body.reason}`,
  {
    relatedType: 'report'
  }
);

export const logResourceBookmarked = logActivity(
  'resource_bookmarked',
  'Bookmarked a resource',
  {
    relatedType: 'resource'
  }
);

export const logFileUploaded = logActivity(
  'file_uploaded',
  (req) => `Uploaded a ${req.file?.mimetype?.split('/')[0] || 'file'}`,
  {
    metadata: (req) => ({
      filename: req.file?.originalname,
      size: req.file?.size,
      mimetype: req.file?.mimetype
    })
  }
);

export const logConnectionRequestSent = logActivity(
  'connection_request_sent',
  (req) => `Sent ${req.body.type} connection request`,
  {
    relatedType: 'user'
  }
);

export const logConnectionAccepted = logActivity(
  'connection_accepted',
  (req) => `Accepted connection request`,
  {
    relatedType: 'user'
  }
);

export const logMessageSent = logActivity(
  'message_sent',
  'Sent a message',
  {
    relatedType: 'message'
  }
);

// Helper function to log activity directly (for use in controllers)
export const directLogActivity = async (userId, type, description, options = {}) => {
  try {
    return await Activity.logActivity(userId, type, description, options);
  } catch (error) {
    console.error('Failed to log activity:', error);
    return null;
  }
};

// Helper function to log signup activity (since it happens before user is authenticated)
export const logSignup = async (userId, req) => {
  try {
    return await Activity.logActivity(userId, 'signup', 'Created account and joined the community', {
      req,
      points: 10,
      metadata: {
        method: 'POST',
        path: '/auth/register',
        welcomeBonus: true
      }
    });
  } catch (error) {
    console.error('Failed to log signup activity:', error);
    return null;
  }
};
