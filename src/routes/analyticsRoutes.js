import express from 'express';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Course from '../models/Course.js';
import Event from '../models/Event.js';
import Challenge from '../models/Challenge.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All analytics routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

// @desc    Get dashboard analytics
// @route   GET /api/analytics/dashboard
// @access  Private (Admin)
router.get('/dashboard', asyncHandler(async (req, res) => {
  const { timeframe = '30d' } = req.query;

  let dateFilter = {};
  const now = new Date();
  
  switch (timeframe) {
    case '7d':
      dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      break;
    case '30d':
      dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      break;
    case '90d':
      dateFilter = { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
      break;
  }

  const [
    totalUsers,
    activeUsers,
    newUsers,
    totalPosts,
    totalCourses,
    totalEvents,
    userGrowth,
    postActivity,
    courseEngagement,
    phaseDistribution,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ lastActive: dateFilter }),
    User.countDocuments({ createdAt: dateFilter }),
    Post.countDocuments({ isApproved: true }),
    Course.countDocuments({ isPublished: true }),
    Event.countDocuments({ status: 'scheduled', date: { $gte: new Date() } }),
    
    // User growth over time
    User.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    
    // Post activity
    Post.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    
    // Course engagement
    User.aggregate([
      { $unwind: '$courses' },
      { $match: { 'courses.enrolledAt': dateFilter } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$courses.enrolledAt' } },
          enrollments: { $sum: 1 },
          avgProgress: { $avg: '$courses.progress' }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    
    // Phase distribution
    User.aggregate([
      { $group: { _id: '$phase', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalUsers,
        activeUsers,
        newUsers,
        totalPosts,
        totalCourses,
        totalEvents,
      },
      charts: {
        userGrowth,
        postActivity,
        courseEngagement,
        phaseDistribution,
      },
      timeframe,
    },
  });
}));

// @desc    Get user engagement analytics
// @route   GET /api/analytics/engagement
// @access  Private (Admin)
router.get('/engagement', asyncHandler(async (req, res) => {
  const { timeframe = '30d' } = req.query;

  let dateFilter = {};
  const now = new Date();
  
  switch (timeframe) {
    case '7d':
      dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      break;
    case '30d':
      dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      break;
    case '90d':
      dateFilter = { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
      break;
  }

  const [
    dailyActiveUsers,
    postEngagement,
    courseCompletion,
    eventAttendance,
    challengeParticipation,
  ] = await Promise.all([
    // Daily active users
    User.aggregate([
      { $match: { lastActive: dateFilter } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastActive' } },
          users: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    
    // Post engagement metrics
    Post.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: '$category',
          posts: { $sum: 1 },
          totalLikes: { $sum: { $size: '$likes' } },
          totalComments: { $sum: { $size: '$comments' } },
          avgLikes: { $avg: { $size: '$likes' } },
          avgComments: { $avg: { $size: '$comments' } },
        }
      },
      { $sort: { posts: -1 } }
    ]),
    
    // Course completion rates
    Course.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'courses.courseId',
          as: 'enrollments'
        }
      },
      {
        $project: {
          title: 1,
          category: 1,
          totalEnrollments: { $size: '$enrollments' },
          completions: {
            $size: {
              $filter: {
                input: '$enrollments',
                cond: {
                  $gte: [
                    {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$$this.courses',
                            cond: { $eq: ['$$this.courseId', '$_id'] }
                          }
                        }, 0
                      ]
                    }, 100
                  ]
                }
              }
            }
          }
        }
      },
      {
        $addFields: {
          completionRate: {
            $cond: [
              { $eq: ['$totalEnrollments', 0] },
              0,
              { $multiply: [{ $divide: ['$completions', '$totalEnrollments'] }, 100] }
            ]
          }
        }
      }
    ]),
    
    // Event attendance
    Event.aggregate([
      { $match: { date: dateFilter } },
      {
        $project: {
          title: 1,
          type: 1,
          date: 1,
          maxAttendees: 1,
          attendeeCount: { $size: '$attendees' },
          goingCount: {
            $size: {
              $filter: {
                input: '$attendees',
                cond: { $eq: ['$$this.status', 'going'] }
              }
            }
          }
        }
      },
      {
        $addFields: {
          attendanceRate: {
            $cond: [
              { $eq: ['$maxAttendees', 0] },
              0,
              { $multiply: [{ $divide: ['$goingCount', '$maxAttendees'] }, 100] }
            ]
          }
        }
      }
    ]),
    
    // Challenge participation
    Challenge.aggregate([
      { $match: { startDate: dateFilter } },
      {
        $project: {
          title: 1,
          type: 1,
          participantCount: { $size: '$participants' },
          completionCount: {
            $size: {
              $filter: {
                input: '$participants',
                cond: { $eq: ['$$this.isCompleted', true] }
              }
            }
          }
        }
      },
      {
        $addFields: {
          completionRate: {
            $cond: [
              { $eq: ['$participantCount', 0] },
              0,
              { $multiply: [{ $divide: ['$completionCount', '$participantCount'] }, 100] }
            ]
          }
        }
      }
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      dailyActiveUsers,
      postEngagement,
      courseCompletion,
      eventAttendance,
      challengeParticipation,
      timeframe,
    },
  });
}));

// @desc    Get user retention analytics
// @route   GET /api/analytics/retention
// @access  Private (Admin)
router.get('/retention', asyncHandler(async (req, res) => {
  const [
    totalUsers,
    activeIn7Days,
    activeIn30Days,
    retentionCohorts,
    churnAnalysis,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({
      lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }),
    User.countDocuments({
      lastActive: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }),
    
    // Retention by join cohort
    User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalUsers: { $sum: 1 },
          stillActive: {
            $sum: {
              $cond: [
                { $gte: ['$lastActive', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          retentionRate: {
            $multiply: [{ $divide: ['$stillActive', '$totalUsers'] }, 100]
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),
    
    // Churn analysis
    User.aggregate([
      {
        $match: {
          lastActive: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$phase',
          churnedUsers: { $sum: 1 }
        }
      }
    ]),
  ]);

  const retention7Day = (activeIn7Days / totalUsers) * 100;
  const retention30Day = (activeIn30Days / totalUsers) * 100;

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalUsers,
        retention7Day: Math.round(retention7Day),
        retention30Day: Math.round(retention30Day),
      },
      retentionCohorts,
      churnAnalysis,
    },
  });
}));

// @desc    Export analytics data
// @route   GET /api/analytics/export
// @access  Private (Admin)
router.get('/export', asyncHandler(async (req, res) => {
  const { type = 'users', format = 'json' } = req.query;

  let data;
  let filename;

  switch (type) {
    case 'users':
      data = await User.find()
        .select('name username email phase level points createdAt lastActive')
        .lean();
      filename = 'users_export';
      break;
    case 'posts':
      data = await Post.find({ isApproved: true })
        .populate('author', 'name username')
        .select('content category likes comments createdAt')
        .lean();
      filename = 'posts_export';
      break;
    case 'courses':
      data = await Course.find()
        .select('title category enrollmentCount completionRate rating.average')
        .lean();
      filename = 'courses_export';
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'Invalid export type',
      });
  }

  if (format === 'csv') {
    // Convert to CSV format
    const csv = convertToCSV(data);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
    res.send(csv);
  } else {
    res.status(200).json({
      success: true,
      data,
      exportInfo: {
        type,
        format,
        count: data.length,
        generatedAt: new Date().toISOString(),
      },
    });
  }
}));

// Helper function to convert JSON to CSV
const convertToCSV = (data) => {
  if (!data.length) return '';
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
};

export default router;