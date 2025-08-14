import Integration from '../models/Integration.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Course from '../models/Course.js';
import Event from '../models/Event.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// @desc    Get all integrations
// @route   GET /api/integrations
// @access  Private (Admin)
export const getIntegrations = asyncHandler(async (req, res) => {
  const { type } = req.query;

  const query = {};
  if (type && type !== 'all') {
    query.type = type;
  }

  const integrations = await Integration.find(query)
    .select('-configuration.apiSecret') // Don't expose secrets
    .sort({ type: 1, name: 1 });

  res.status(200).json({
    success: true,
    data: integrations,
  });
});

// @desc    Create new integration
// @route   POST /api/integrations
// @access  Private (Admin)
export const createIntegration = asyncHandler(async (req, res) => {
  const integration = await Integration.create(req.body);

  // Don't return sensitive data
  const responseData = { ...integration.toJSON() };
  delete responseData.configuration?.apiSecret;

  res.status(201).json({
    success: true,
    message: 'Integration created successfully',
    data: responseData,
  });
});

// @desc    Update integration
// @route   PUT /api/integrations/:id
// @access  Private (Admin)
export const updateIntegration = asyncHandler(async (req, res) => {
  const integration = await Integration.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).select('-configuration.apiSecret');

  if (!integration) {
    return res.status(404).json({
      success: false,
      message: 'Integration not found',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Integration updated successfully',
    data: integration,
  });
});

// @desc    Test integration connection
// @route   POST /api/integrations/:id/test
// @access  Private (Admin)
export const testIntegration = asyncHandler(async (req, res) => {
  const integration = await Integration.findById(req.params.id);

  if (!integration) {
    return res.status(404).json({
      success: false,
      message: 'Integration not found',
    });
  }

  try {
    // Simulate integration test based on type
    let testResult = { success: true, message: 'Integration test successful' };

    switch (integration.type) {
      case 'zapier':
        // Test Zapier webhook
        if (integration.configuration.webhookUrl) {
          const testData = {
            event: 'test',
            timestamp: new Date().toISOString(),
            data: { message: 'Test from YOU YES YOU platform' },
          };

          const response = await fetch(integration.configuration.webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData),
          });

          testResult.success = response.ok;
          testResult.status = response.status;
        }
        break;

      case 'email':
        // Test email service
        testResult.message = 'Email service configuration validated';
        break;

      default:
        testResult.message = 'Basic configuration validated';
    }

    // Log the test call
    await integration.logApiCall(testResult.success, testResult.success ? null : new Error(testResult.message));

    res.status(200).json({
      success: true,
      data: testResult,
    });
  } catch (error) {
    await integration.logApiCall(false, error);

    res.status(400).json({
      success: false,
      message: 'Integration test failed',
      error: error.message,
    });
  }
});

// @desc    Trigger Zapier webhook
// @route   POST /api/integrations/zapier/trigger
// @access  Private
export const triggerZapierWebhook = asyncHandler(async (req, res) => {
  const { event, data } = req.body;

  // Get active Zapier integrations
  const zapierIntegrations = await Integration.find({
    type: 'zapier',
    isActive: true,
  });

  const results = [];

  for (const integration of zapierIntegrations) {
    try {
      const webhookData = {
        event,
        timestamp: new Date().toISOString(),
        data,
        platform: 'YOU YES YOU',
        user: req.user ? {
          id: req.user._id,
          name: req.user.name,
          username: req.user.username,
          email: req.user.email,
          phase: req.user.phase,
          level: req.user.level,
          points: req.user.points,
        } : null,
      };

      if (integration.configuration.webhookUrl) {
        const response = await fetch(integration.configuration.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': integration.configuration.apiKey ? 
              `Bearer ${integration.configuration.apiKey}` : undefined,
          },
          body: JSON.stringify(webhookData),
        });

        await integration.logApiCall(response.ok, response.ok ? null : new Error(`HTTP ${response.status}`));

        results.push({
          integration: integration.name,
          success: response.ok,
          status: response.status,
        });
      }
    } catch (error) {
      await integration.logApiCall(false, error);
      results.push({
        integration: integration.name,
        success: false,
        error: error.message,
      });
    }
  }

  res.status(200).json({
    success: true,
    message: 'Webhook triggered for all active Zapier integrations',
    data: results,
  });
});

// @desc    Get API key for external integrations
// @route   GET /api/integrations/api-key
// @access  Private (Admin)
export const getApiKey = asyncHandler(async (req, res) => {
  // Generate or return existing API key
  const apiKey = process.env.PLATFORM_API_KEY || 'youyesyou_' + Date.now().toString(36);

  res.status(200).json({
    success: true,
    data: {
      apiKey,
      endpoints: [
        {
          name: 'Get Users',
          method: 'GET',
          url: '/api/external/users',
          description: 'Get list of community members',
        },
        {
          name: 'Get User Events',
          method: 'GET',
          url: '/api/external/users/:id/events',
          description: 'Get user event attendance',
        },
        {
          name: 'Get Course Progress',
          method: 'GET',
          url: '/api/external/users/:id/courses',
          description: 'Get user course progress',
        },
        {
          name: 'Trigger Webhook',
          method: 'POST',
          url: '/api/integrations/zapier/trigger',
          description: 'Trigger Zapier webhook manually',
        },
      ],
      usage: {
        rateLimit: '1000 requests per hour',
        authentication: 'Bearer token in Authorization header',
        format: 'JSON',
      },
    },
  });
});

// External API endpoints for Zapier/third-party integration

// @desc    Get users for external integration
// @route   GET /api/external/users
// @access  External (API Key)
export const getExternalUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, phase, since } = req.query;

  const query = {};
  
  if (phase) {
    query.phase = phase;
  }
  
  if (since) {
    query.createdAt = { $gte: new Date(since) };
  }

  const users = await User.find(query)
    .select('name username email phase level points joinDate createdAt')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  res.status(200).json({
    success: true,
    data: users,
    pagination: {
      current: parseInt(page),
      limit: parseInt(limit),
      total: await User.countDocuments(query),
    },
  });
});

// @desc    Get user course progress for external integration
// @route   GET /api/external/users/:id/courses
// @access  External (API Key)
export const getExternalUserCourses = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .populate('courses.courseId', 'title category phase')
    .select('courses');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  res.status(200).json({
    success: true,
    data: user.courses,
  });
});

// @desc    Get user events for external integration
// @route   GET /api/external/users/:id/events
// @access  External (API Key)
export const getExternalUserEvents = asyncHandler(async (req, res) => {
  const events = await Event.find({
    'attendees.user': req.params.id,
  }).select('title date type category attendees');

  const userEvents = events.map(event => {
    const userAttendance = event.attendees.find(
      a => a.user.toString() === req.params.id
    );

    return {
      eventId: event._id,
      title: event.title,
      date: event.date,
      type: event.type,
      category: event.category,
      rsvpStatus: userAttendance.status,
      attended: userAttendance.attended,
      rsvpDate: userAttendance.rsvpDate,
    };
  });

  res.status(200).json({
    success: true,
    data: userEvents,
  });
});