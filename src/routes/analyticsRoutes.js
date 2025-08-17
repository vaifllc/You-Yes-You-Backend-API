import express from 'express';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Course from '../models/Course.js';
import Event from '../models/Event.js';
import Challenge from '../models/Challenge.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Store system metrics for tracking over time
let systemMetricsHistory = [];
let lastHealthCheck = null;

// All analytics routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

// Helper function to get memory usage
const getMemoryUsage = () => {
  const used = process.memoryUsage();
  const total = os.totalmem();
  const free = os.freemem();

  return {
    heap: {
      used: Math.round((used.heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((used.heapTotal / 1024 / 1024) * 100) / 100
    },
    system: {
      used: Math.round(((total - free) / 1024 / 1024) * 100) / 100,
      total: Math.round((total / 1024 / 1024) * 100) / 100,
      usage: Math.round(((total - free) / total) * 100)
    }
  };
};

// Helper function to get CPU usage
const getCPUUsage = () => {
  const cpus = os.cpus();
  const numCores = cpus.length;

  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / numCores;
  const total = totalTick / numCores;
  const usage = Math.round(((total - idle) / total) * 100);

  return {
    cores: numCores,
    usage,
    loadAverage: os.loadavg().map(load => Math.round(load * 100) / 100)
  };
};

// Helper function to get disk usage
const getDiskUsage = async () => {
  try {
    const stats = await fs.stat('.');
    const uploadPath = process.env.UPLOAD_PATH || './uploads';

    let uploadSize = 0;
    try {
      const uploadStats = await fs.stat(uploadPath);
      uploadSize = uploadStats.size;
    } catch (e) {
      // Upload directory might not exist
    }

    return {
      available: process.env.DISK_SPACE_TOTAL || '—',
      used: process.env.DISK_SPACE_USED || '—',
      usage: process.env.DISK_USAGE_PERCENT || '—',
      uploadsSize: Math.round((uploadSize / 1024 / 1024) * 100) / 100 // MB
    };
  } catch (error) {
    return {
      available: '—',
      used: '—',
      usage: '—',
      uploadsSize: 0
    };
  }
};

// Helper function to get network stats
const getNetworkStats = () => {
  const networkInterfaces = os.networkInterfaces();
  const activeInterfaces = Object.values(networkInterfaces)
    .flat()
    .filter(iface => !iface.internal && iface.family === 'IPv4');

  return {
    interfaces: activeInterfaces.length,
    hostname: os.hostname(),
    platform: os.platform(),
    architecture: os.arch()
  };
};

// Helper function to get database stats
const getDatabaseStats = async () => {
  try {
    const admin = mongoose.connection.db.admin();
    const [serverStatus, dbStats] = await Promise.all([
      admin.serverStatus(),
      mongoose.connection.db.stats()
    ]);

    return {
      connections: serverStatus.connections,
      uptime: serverStatus.uptime,
      version: serverStatus.version,
      collections: dbStats.collections,
      dataSize: Math.round((dbStats.dataSize / 1024 / 1024) * 100) / 100, // MB
      indexSize: Math.round((dbStats.indexSize / 1024 / 1024) * 100) / 100, // MB
      storageSize: Math.round((dbStats.storageSize / 1024 / 1024) * 100) / 100 // MB
    };
  } catch (error) {
    console.error('Database stats error:', error);
    return {
      connections: { current: 0, available: 0 },
      uptime: 0,
      version: 'unknown',
      collections: 0,
      dataSize: 0,
      indexSize: 0,
      storageSize: 0
    };
  }
};

// Helper function to calculate user satisfaction score
const calculateUserSatisfaction = async () => {
  try {
    const [
      totalUsers,
      activeUsers,
      postsThisWeek,
      coursesCompleted,
      eventsAttended
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({
        lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),
      Post.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),
      User.aggregate([
        { $unwind: '$courses' },
        { $match: { 'courses.progress': 100 } },
        { $count: 'completed' }
      ]),
      Event.countDocuments({
        date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        'attendees.status': 'attended'
      })
    ]);

    // Calculate engagement score (0-100)
    const activeRatio = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;
    const postsPerActiveUser = activeUsers > 0 ? postsThisWeek / activeUsers : 0;
    const completionRate = coursesCompleted.length > 0 ? coursesCompleted[0].completed / activeUsers : 0;

    const satisfactionScore = Math.min(100, Math.round(
      (activeRatio * 0.4) +
      (Math.min(postsPerActiveUser * 20, 30) * 0.3) +
      (completionRate * 100 * 0.3)
    ));

    return {
      score: satisfactionScore,
      metrics: {
        activeRatio: Math.round(activeRatio),
        postsPerUser: Math.round(postsPerActiveUser * 100) / 100,
        completionRate: Math.round(completionRate * 100)
      }
    };
  } catch (error) {
    console.error('User satisfaction calculation error:', error);
    return {
      score: 0,
      metrics: {
        activeRatio: 0,
        postsPerUser: 0,
        completionRate: 0
      }
    };
  }
};

// Comprehensive system health check
const performSystemHealthCheck = async () => {
  const start = Date.now();

  try {
    // Database performance test
    let dbMs = 0;
    let dbStatus = 'error';
    try {
      const pingStart = Date.now();
      await mongoose.connection.db.admin().ping();
      dbMs = Date.now() - pingStart;

      if (dbMs < 100) dbStatus = 'excellent';
      else if (dbMs < 300) dbStatus = 'good';
      else if (dbMs < 1000) dbStatus = 'warning';
      else dbStatus = 'error';
    } catch (e) {
      dbMs = -1;
      dbStatus = 'error';
    }

    // Get system metrics
    const [memory, cpu, disk, network, dbStats, userSatisfaction] = await Promise.all([
      Promise.resolve(getMemoryUsage()),
      Promise.resolve(getCPUUsage()),
      getDiskUsage(),
      Promise.resolve(getNetworkStats()),
      getDatabaseStats(),
      calculateUserSatisfaction()
    ]);

    const apiMs = Date.now() - start;

    // Generate health status for each metric
    const systemHealth = [
      {
        metric: 'API Response Time',
        value: `${apiMs}ms`,
        status: apiMs < 200 ? 'excellent' : (apiMs < 500 ? 'good' : (apiMs < 1000 ? 'warning' : 'error')),
        color: apiMs < 200 ? 'text-green-600' : (apiMs < 500 ? 'text-blue-600' : (apiMs < 1000 ? 'text-yellow-600' : 'text-red-600')),
        details: { responseTime: apiMs, threshold: '< 500ms' }
      },
      {
        metric: 'Database Performance',
        value: dbMs >= 0 ? `${dbMs}ms` : 'Error',
        status: dbStatus,
        color: dbStatus === 'excellent' ? 'text-green-600' :
               (dbStatus === 'good' ? 'text-blue-600' :
               (dbStatus === 'warning' ? 'text-yellow-600' : 'text-red-600')),
        details: {
          pingTime: dbMs,
          connections: dbStats.connections,
          uptime: dbStats.uptime,
          version: dbStats.version
        }
      },
      {
        metric: 'Memory Usage',
        value: `${memory.system.usage}%`,
        status: memory.system.usage < 70 ? 'good' : (memory.system.usage < 85 ? 'warning' : 'error'),
        color: memory.system.usage < 70 ? 'text-green-600' : (memory.system.usage < 85 ? 'text-yellow-600' : 'text-red-600'),
        details: {
          heap: memory.heap,
          system: memory.system
        }
      },
      {
        metric: 'CPU Usage',
        value: `${cpu.usage}%`,
        status: cpu.usage < 70 ? 'good' : (cpu.usage < 85 ? 'warning' : 'error'),
        color: cpu.usage < 70 ? 'text-green-600' : (cpu.usage < 85 ? 'text-yellow-600' : 'text-red-600'),
        details: {
          cores: cpu.cores,
          usage: cpu.usage,
          loadAverage: cpu.loadAverage
        }
      },
      {
        metric: 'Disk Usage',
        value: typeof disk.usage === 'number' ? `${disk.usage}%` : disk.usage,
        status: typeof disk.usage === 'number' ?
          (disk.usage < 80 ? 'good' : (disk.usage < 90 ? 'warning' : 'error')) : 'info',
        color: typeof disk.usage === 'number' ?
          (disk.usage < 80 ? 'text-green-600' : (disk.usage < 90 ? 'text-yellow-600' : 'text-red-600')) :
          'text-blue-600',
        details: disk
      },
      {
        metric: 'User Satisfaction',
        value: `${userSatisfaction.score}%`,
        status: userSatisfaction.score > 80 ? 'excellent' :
               (userSatisfaction.score > 60 ? 'good' :
               (userSatisfaction.score > 40 ? 'warning' : 'error')),
        color: userSatisfaction.score > 80 ? 'text-green-600' :
               (userSatisfaction.score > 60 ? 'text-blue-600' :
               (userSatisfaction.score > 40 ? 'text-yellow-600' : 'text-red-600')),
        details: userSatisfaction.metrics
      },
      {
        metric: 'Network Status',
        value: `${network.interfaces} active`,
        status: network.interfaces > 0 ? 'good' : 'warning',
        color: network.interfaces > 0 ? 'text-green-600' : 'text-yellow-600',
        details: {
          hostname: network.hostname,
          platform: network.platform,
          architecture: network.architecture,
          activeInterfaces: network.interfaces
        }
      },
      {
        metric: 'Database Storage',
        value: `${dbStats.dataSize + dbStats.indexSize} MB`,
        status: 'info',
        color: 'text-blue-600',
        details: {
          collections: dbStats.collections,
          dataSize: dbStats.dataSize,
          indexSize: dbStats.indexSize,
          storageSize: dbStats.storageSize
        }
      }
    ];

    // Store metrics for historical tracking
    const healthSnapshot = {
      timestamp: new Date(),
      apiResponseTime: apiMs,
      dbResponseTime: dbMs,
      memoryUsage: memory.system.usage,
      cpuUsage: cpu.usage,
      userSatisfaction: userSatisfaction.score,
      overallStatus: systemHealth.every(metric =>
        ['excellent', 'good', 'info'].includes(metric.status)
      ) ? 'healthy' : 'needs_attention'
    };

    // Keep only last 100 snapshots
    systemMetricsHistory.push(healthSnapshot);
    if (systemMetricsHistory.length > 100) {
      systemMetricsHistory = systemMetricsHistory.slice(-100);
    }

    lastHealthCheck = {
      timestamp: new Date(),
      systemHealth,
      summary: {
        totalMetrics: systemHealth.length,
        healthyMetrics: systemHealth.filter(m => ['excellent', 'good', 'info'].includes(m.status)).length,
        warningMetrics: systemHealth.filter(m => m.status === 'warning').length,
        errorMetrics: systemHealth.filter(m => m.status === 'error').length,
        overallStatus: healthSnapshot.overallStatus
      },
      performance: {
        apiResponseTime: apiMs,
        dbResponseTime: dbMs,
        totalCheckTime: Date.now() - start
      }
    };

    return lastHealthCheck;

  } catch (error) {
    console.error('System health check failed:', error);
    return {
      timestamp: new Date(),
      error: 'Health check failed',
      systemHealth: [],
      summary: {
        totalMetrics: 0,
        healthyMetrics: 0,
        warningMetrics: 0,
        errorMetrics: 0,
        overallStatus: 'error'
      },
      performance: {
        apiResponseTime: Date.now() - start,
        dbResponseTime: -1,
        totalCheckTime: Date.now() - start
      }
    };
  }
};

// @desc    Get dashboard analytics
// @route   GET /api/analytics/dashboard
// @access  Private (Admin)
router.get('/dashboard', asyncHandler(async (req, res) => {
  const routeStart = Date.now();
  const { timeframe = '30d' } = req.query;

  console.log('[Analytics] /dashboard requested', { timeframe });

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

  console.log('[Analytics] /dashboard overview', {
    totalUsers,
    activeUsers,
    newUsers,
    totalPosts,
    totalCourses,
    totalEvents,
  });

  // Perform comprehensive system health check
  const healthCheck = await performSystemHealthCheck();

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
      systemHealth: healthCheck.systemHealth,
      healthSummary: healthCheck.summary,
      performance: healthCheck.performance,
      timeframe,
    },
  });
}));

// @desc    Get comprehensive system health metrics
// @route   GET /api/analytics/health
// @access  Private (Admin)
router.get('/health', asyncHandler(async (req, res) => {
  const healthCheck = await performSystemHealthCheck();

  res.status(200).json({
    success: true,
    data: healthCheck
  });
}));

// @desc    Get system health history
// @route   GET /api/analytics/health/history
// @access  Private (Admin)
router.get('/health/history', asyncHandler(async (req, res) => {
  const { hours = 24 } = req.query;
  const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));

  const recentHistory = systemMetricsHistory.filter(
    snapshot => snapshot.timestamp >= cutoff
  );

  res.status(200).json({
    success: true,
    data: {
      history: recentHistory,
      summary: {
        totalSnapshots: recentHistory.length,
        timeRange: `${hours} hours`,
        oldestSnapshot: recentHistory.length > 0 ? recentHistory[0].timestamp : null,
        latestSnapshot: recentHistory.length > 0 ? recentHistory[recentHistory.length - 1].timestamp : null
      }
    }
  });
}));

// @desc    Get real-time system status
// @route   GET /api/analytics/status
// @access  Private (Admin)
router.get('/status', asyncHandler(async (req, res) => {
  const start = Date.now();

  // Quick health indicators
  const memory = getMemoryUsage();
  const cpu = getCPUUsage();

  let dbPing = 0;
  try {
    const pingStart = Date.now();
    await mongoose.connection.db.admin().ping();
    dbPing = Date.now() - pingStart;
  } catch (e) {
    dbPing = -1;
  }

  const responseTime = Date.now() - start;

  const quickStatus = {
    timestamp: new Date(),
    status: 'online',
    responseTime: responseTime,
    database: {
      status: dbPing >= 0 ? 'connected' : 'error',
      pingTime: dbPing
    },
    memory: {
      usage: memory.system.usage,
      heap: memory.heap.used
    },
    cpu: {
      usage: cpu.usage,
      cores: cpu.cores
    },
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  };

  res.status(200).json({
    success: true,
    data: quickStatus
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
    case 'health':
      data = systemMetricsHistory;
      filename = 'health_metrics_export';
      break;
    case 'system':
      data = await performSystemHealthCheck();
      filename = 'system_status_export';
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'Invalid export type. Available types: users, posts, courses, health, system',
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
        count: Array.isArray(data) ? data.length : 1,
        generatedAt: new Date().toISOString(),
      },
    });
  }
}));

// @desc    Get system alerts and warnings
// @route   GET /api/analytics/alerts
// @access  Private (Admin)
router.get('/alerts', asyncHandler(async (req, res) => {
  const alerts = [];

  // Check recent health data for issues
  if (lastHealthCheck) {
    lastHealthCheck.systemHealth.forEach(metric => {
      if (metric.status === 'error') {
        alerts.push({
          type: 'error',
          metric: metric.metric,
          message: `${metric.metric} is in error state: ${metric.value}`,
          timestamp: lastHealthCheck.timestamp,
          severity: 'high',
          details: metric.details
        });
      } else if (metric.status === 'warning') {
        alerts.push({
          type: 'warning',
          metric: metric.metric,
          message: `${metric.metric} needs attention: ${metric.value}`,
          timestamp: lastHealthCheck.timestamp,
          severity: 'medium',
          details: metric.details
        });
      }
    });
  }

  // Check for data anomalies
  try {
    const [
      todayUsers,
      yesterdayUsers,
      todayPosts,
      yesterdayPosts,
      failedLogins
    ] = await Promise.all([
      User.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      }),
      User.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setDate(new Date().getDate() - 1)).setHours(0, 0, 0, 0),
          $lt: new Date(new Date().setDate(new Date().getDate() - 1)).setHours(23, 59, 59, 999)
        }
      }),
      Post.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      }),
      Post.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setDate(new Date().getDate() - 1)).setHours(0, 0, 0, 0),
          $lt: new Date(new Date().setDate(new Date().getDate() - 1)).setHours(23, 59, 59, 999)
        }
      }),
      // Assuming you have a failed login tracking mechanism
      Promise.resolve(0) // Placeholder - implement based on your auth system
    ]);

    // Check for unusual drops in activity
    if (yesterdayUsers > 0 && todayUsers < (yesterdayUsers * 0.5)) {
      alerts.push({
        type: 'warning',
        metric: 'User Registrations',
        message: `Significant drop in new user registrations: ${todayUsers} today vs ${yesterdayUsers} yesterday`,
        timestamp: new Date(),
        severity: 'medium',
        details: { todayUsers, yesterdayUsers, dropPercentage: Math.round(((yesterdayUsers - todayUsers) / yesterdayUsers) * 100) }
      });
    }

    if (yesterdayPosts > 0 && todayPosts < (yesterdayPosts * 0.3)) {
      alerts.push({
        type: 'warning',
        metric: 'Post Activity',
        message: `Significant drop in post activity: ${todayPosts} today vs ${yesterdayPosts} yesterday`,
        timestamp: new Date(),
        severity: 'medium',
        details: { todayPosts, yesterdayPosts, dropPercentage: Math.round(((yesterdayPosts - todayPosts) / yesterdayPosts) * 100) }
      });
    }

  } catch (error) {
    alerts.push({
      type: 'error',
      metric: 'Analytics System',
      message: 'Failed to check for data anomalies',
      timestamp: new Date(),
      severity: 'high',
      details: { error: error.message }
    });
  }

  // Sort alerts by severity and timestamp
  const severityOrder = { high: 3, medium: 2, low: 1 };
  alerts.sort((a, b) => {
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  res.status(200).json({
    success: true,
    data: {
      alerts,
      summary: {
        total: alerts.length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length,
        lastChecked: new Date()
      }
    }
  });
}));

// @desc    Get performance trends
// @route   GET /api/analytics/trends
// @access  Private (Admin)
router.get('/trends', asyncHandler(async (req, res) => {
  const { metric = 'all', period = '24h' } = req.query;

  let hours = 24;
  switch (period) {
    case '1h': hours = 1; break;
    case '6h': hours = 6; break;
    case '24h': hours = 24; break;
    case '7d': hours = 168; break;
    case '30d': hours = 720; break;
  }

  const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
  const relevantHistory = systemMetricsHistory.filter(
    snapshot => snapshot.timestamp >= cutoff
  );

  if (relevantHistory.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        message: 'No historical data available for the specified period',
        period,
        availableFrom: systemMetricsHistory.length > 0 ? systemMetricsHistory[0].timestamp : null
      }
    });
  }

  // Calculate trends
  const trends = {};

  if (metric === 'all' || metric === 'response_time') {
    const responseTimes = relevantHistory.map(h => h.apiResponseTime).filter(t => t > 0);
    trends.responseTime = calculateTrendStats(responseTimes, 'API Response Time', 'ms');
  }

  if (metric === 'all' || metric === 'database') {
    const dbTimes = relevantHistory.map(h => h.dbResponseTime).filter(t => t > 0);
    trends.database = calculateTrendStats(dbTimes, 'Database Response Time', 'ms');
  }

  if (metric === 'all' || metric === 'memory') {
    const memoryUsage = relevantHistory.map(h => h.memoryUsage).filter(u => u > 0);
    trends.memory = calculateTrendStats(memoryUsage, 'Memory Usage', '%');
  }

  if (metric === 'all' || metric === 'cpu') {
    const cpuUsage = relevantHistory.map(h => h.cpuUsage).filter(u => u > 0);
    trends.cpu = calculateTrendStats(cpuUsage, 'CPU Usage', '%');
  }

  if (metric === 'all' || metric === 'satisfaction') {
    const satisfaction = relevantHistory.map(h => h.userSatisfaction).filter(s => s > 0);
    trends.satisfaction = calculateTrendStats(satisfaction, 'User Satisfaction', '%');
  }

  res.status(200).json({
    success: true,
    data: {
      trends,
      period,
      dataPoints: relevantHistory.length,
      timeRange: {
        from: relevantHistory[0]?.timestamp,
        to: relevantHistory[relevantHistory.length - 1]?.timestamp
      }
    }
  });
}));

// Helper function to calculate trend statistics
const calculateTrendStats = (values, metricName, unit) => {
  if (values.length === 0) {
    return {
      metric: metricName,
      unit,
      noData: true
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;

  // Calculate trend direction
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const trendDirection = secondAvg > firstAvg ? 'increasing' :
                        secondAvg < firstAvg ? 'decreasing' : 'stable';
  const trendPercentage = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

  return {
    metric: metricName,
    unit,
    current: Math.round(values[values.length - 1] * 100) / 100,
    average: Math.round(avg * 100) / 100,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[Math.floor(sorted.length / 2)],
    trend: {
      direction: trendDirection,
      percentage: Math.abs(trendPercentage),
      status: trendDirection === 'stable' ? 'stable' :
              (metricName.includes('Response Time') || metricName.includes('Usage')) ?
                (trendDirection === 'increasing' ? 'concerning' : 'improving') :
                (trendDirection === 'increasing' ? 'improving' : 'concerning')
    },
    dataPoints: values.length
  };
};

export default router;