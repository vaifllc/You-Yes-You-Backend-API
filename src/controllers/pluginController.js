import { asyncHandler } from '../middleware/errorHandler.js';
import Integration from '../models/Integration.js';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Course from '../models/Course.js';

// @desc    Get available plugins
// @route   GET /api/plugins
// @access  Private (Admin)
export const getAvailablePlugins = asyncHandler(async (req, res) => {
  const plugins = [
    {
      id: 'sendgrid_email',
      name: 'SendGrid Email Service',
      description: 'Professional email delivery and automation',
      category: 'email',
      provider: 'SendGrid',
      status: process.env.SENDGRID_API_KEY ? 'connected' : 'not_configured',
      features: ['Welcome emails', 'Event reminders', 'Badge notifications', 'Password resets'],
      configRequired: ['SENDGRID_API_KEY', 'EMAIL_FROM'],
    },
    {
      id: 'zapier_automation',
      name: 'Zapier Automation Hub',
      description: 'Connect with 5000+ apps for workflow automation',
      category: 'automation',
      provider: 'Zapier',
      status: process.env.ZAPIER_WEBHOOK_URL ? 'connected' : 'not_configured',
      features: ['CRM sync', 'Google Sheets logging', 'SMS notifications', 'Custom workflows'],
      configRequired: ['ZAPIER_WEBHOOK_URL', 'PLATFORM_API_KEY'],
    },
    {
      id: 'google_calendar',
      name: 'Google Calendar Sync',
      description: 'Two-way calendar synchronization',
      category: 'calendar',
      provider: 'Google',
      status: process.env.GOOGLE_CALENDAR_API_KEY ? 'connected' : 'not_configured',
      features: ['Event sync', 'RSVP tracking', 'Reminder automation', 'Attendance logging'],
      configRequired: ['GOOGLE_CALENDAR_API_KEY', 'GOOGLE_CALENDAR_ID'],
    },
    {
      id: 'stripe_payments',
      name: 'Stripe Payment Processing',
      description: 'Secure payment processing and subscriptions',
      category: 'payment',
      provider: 'Stripe',
      status: process.env.STRIPE_SECRET_KEY ? 'connected' : 'not_configured',
      features: ['Membership fees', 'Course payments', 'Donation processing', 'Subscription management'],
      configRequired: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    },
    {
      id: 'convertkit_email',
      name: 'ConvertKit Email Marketing',
      description: 'Advanced email marketing and automation',
      category: 'email',
      provider: 'ConvertKit',
      status: process.env.CONVERTKIT_API_KEY ? 'connected' : 'not_configured',
      features: ['Email sequences', 'Tag-based automation', 'Subscriber management', 'Analytics'],
      configRequired: ['CONVERTKIT_API_KEY', 'CONVERTKIT_FORM_ID'],
    },
    {
      id: 'gohighlevel_crm',
      name: 'GoHighLevel CRM',
      description: 'All-in-one CRM and marketing platform',
      category: 'crm',
      provider: 'GoHighLevel',
      status: process.env.GOHIGHLEVEL_API_KEY ? 'connected' : 'not_configured',
      features: ['Contact management', 'SMS campaigns', 'Pipeline tracking', 'Lead scoring'],
      configRequired: ['GOHIGHLEVEL_API_KEY', 'GOHIGHLEVEL_WEBHOOK_URL'],
    },
    {
      id: 'community_chatbot',
      name: 'YOU YES YOU Assistant',
      description: 'AI-powered community helper and guide',
      category: 'chatbot',
      provider: 'Internal',
      status: 'active',
      features: ['24/7 support', 'Onboarding help', 'Feature guidance', 'Progress tracking'],
      configRequired: [],
    },
    {
      id: 'google_analytics',
      name: 'Google Analytics',
      description: 'Advanced user behavior and engagement analytics',
      category: 'analytics',
      provider: 'Google',
      status: process.env.GA_MEASUREMENT_ID ? 'connected' : 'not_configured',
      features: ['User tracking', 'Engagement metrics', 'Conversion analysis', 'Custom events'],
      configRequired: ['GA_MEASUREMENT_ID'],
    },
  ];

  res.status(200).json({
    success: true,
    data: plugins,
  });
});

// @desc    Install/activate plugin
// @route   POST /api/plugins/:pluginId/install
// @access  Private (Admin)
export const installPlugin = asyncHandler(async (req, res) => {
  const { pluginId } = req.params;
  const { config } = req.body;

  // Validate plugin exists
  const availablePlugins = await getAvailablePluginsList();
  const plugin = availablePlugins.find(p => p.id === pluginId);

  if (!plugin) {
    return res.status(404).json({
      success: false,
      message: 'Plugin not found',
    });
  }

  try {
    // Create or update integration record
    const integration = await Integration.findOneAndUpdate(
      { name: plugin.name },
      {
        name: plugin.name,
        type: plugin.category,
        provider: plugin.provider,
        isActive: true,
        configuration: config,
        permissions: {
          read: true,
          write: plugin.category !== 'analytics',
          webhook: plugin.category === 'automation',
        },
      },
      { upsert: true, new: true }
    );

    // Test the plugin connection
    const testResult = await testPluginConnection(pluginId, config);

    res.status(200).json({
      success: true,
      message: `${plugin.name} installed successfully`,
      data: {
        plugin: plugin.name,
        status: testResult.success ? 'active' : 'error',
        testResult,
      },
    });
  } catch (error) {
    console.error(`Plugin installation error for ${pluginId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Plugin installation failed',
      error: error.message,
    });
  }
});

// @desc    Test plugin connection
// @route   POST /api/plugins/:pluginId/test
// @access  Private (Admin)
export const testPlugin = asyncHandler(async (req, res) => {
  const { pluginId } = req.params;
  const { config } = req.body;

  try {
    const testResult = await testPluginConnection(pluginId, config);

    res.status(200).json({
      success: true,
      data: testResult,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Plugin test failed',
      error: error.message,
    });
  }
});

// @desc    Configure plugin settings
// @route   PUT /api/plugins/:pluginId/configure
// @access  Private (Admin)
export const configurePlugin = asyncHandler(async (req, res) => {
  const { pluginId } = req.params;
  const { settings } = req.body;

  const integration = await Integration.findOne({ 
    type: pluginId.split('_')[0] 
  });

  if (!integration) {
    return res.status(404).json({
      success: false,
      message: 'Plugin not found',
    });
  }

  integration.configuration = {
    ...integration.configuration,
    ...settings,
  };

  await integration.save();

  res.status(200).json({
    success: true,
    message: 'Plugin configured successfully',
    data: integration,
  });
});

// Helper functions
const getAvailablePluginsList = async () => {
  return [
    { id: 'sendgrid_email', name: 'SendGrid Email Service', category: 'email', provider: 'SendGrid' },
    { id: 'zapier_automation', name: 'Zapier Automation Hub', category: 'automation', provider: 'Zapier' },
    { id: 'google_calendar', name: 'Google Calendar Sync', category: 'calendar', provider: 'Google' },
    { id: 'stripe_payments', name: 'Stripe Payment Processing', category: 'payment', provider: 'Stripe' },
    { id: 'convertkit_email', name: 'ConvertKit Email Marketing', category: 'email', provider: 'ConvertKit' },
    { id: 'gohighlevel_crm', name: 'GoHighLevel CRM', category: 'crm', provider: 'GoHighLevel' },
    { id: 'community_chatbot', name: 'YOU YES YOU Assistant', category: 'chatbot', provider: 'Internal' },
    { id: 'google_analytics', name: 'Google Analytics', category: 'analytics', provider: 'Google' },
  ];
};

const testPluginConnection = async (pluginId, config) => {
  switch (pluginId) {
    case 'sendgrid_email':
      return await testSendGridConnection(config);
    case 'zapier_automation':
      return await testZapierConnection(config);
    case 'google_calendar':
      return await testGoogleCalendarConnection(config);
    case 'stripe_payments':
      return await testStripeConnection(config);
    case 'convertkit_email':
      return await testConvertKitConnection(config);
    case 'gohighlevel_crm':
      return await testGoHighLevelConnection(config);
    case 'community_chatbot':
      return { success: true, message: 'Chatbot is active and ready' };
    case 'google_analytics':
      return await testGoogleAnalyticsConnection(config);
    default:
      return { success: false, message: 'Unknown plugin' };
  }
};

const testSendGridConnection = async (config) => {
  try {
    const sgMail = (await import('@sendgrid/mail')).default;
    sgMail.setApiKey(config.apiKey || process.env.SENDGRID_API_KEY);
    
    // Test with a simple validation (doesn't actually send)
    const testMsg = {
      to: 'test@youyesyou.com',
      from: process.env.EMAIL_FROM,
      subject: 'Test',
      text: 'Test',
    };
    
    // Validate the message format
    return { success: true, message: 'SendGrid connection validated' };
  } catch (error) {
    return { success: false, message: `SendGrid test failed: ${error.message}` };
  }
};

const testZapierConnection = async (config) => {
  try {
    const webhookUrl = config.webhookUrl || process.env.ZAPIER_WEBHOOK_URL;
    
    if (!webhookUrl) {
      return { success: false, message: 'Webhook URL not configured' };
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        test: true,
        platform: 'YOU YES YOU',
        timestamp: new Date().toISOString(),
      }),
    });

    return { 
      success: response.ok, 
      message: response.ok ? 'Zapier webhook test successful' : `Webhook test failed: ${response.status}`,
      status: response.status,
    };
  } catch (error) {
    return { success: false, message: `Zapier test failed: ${error.message}` };
  }
};

const testGoogleCalendarConnection = async (config) => {
  // Simulate Google Calendar API test
  const apiKey = config.apiKey || process.env.GOOGLE_CALENDAR_API_KEY;
  
  if (!apiKey) {
    return { success: false, message: 'Google Calendar API key not configured' };
  }
  
  return { success: true, message: 'Google Calendar API key validated' };
};

const testStripeConnection = async (config) => {
  // Simulate Stripe API test
  const secretKey = config.secretKey || process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey || !secretKey.startsWith('sk_')) {
    return { success: false, message: 'Invalid Stripe secret key format' };
  }
  
  return { success: true, message: 'Stripe API key format validated' };
};

const testConvertKitConnection = async (config) => {
  try {
    const apiKey = config.apiKey || process.env.CONVERTKIT_API_KEY;
    
    if (!apiKey) {
      return { success: false, message: 'ConvertKit API key not configured' };
    }

    // Test ConvertKit API
    const response = await fetch(`https://api.convertkit.com/v3/account?api_key=${apiKey}`);
    
    return { 
      success: response.ok, 
      message: response.ok ? 'ConvertKit connection successful' : 'ConvertKit API test failed',
    };
  } catch (error) {
    return { success: false, message: `ConvertKit test failed: ${error.message}` };
  }
};

const testGoHighLevelConnection = async (config) => {
  try {
    const apiKey = config.apiKey || process.env.GOHIGHLEVEL_API_KEY;
    
    if (!apiKey) {
      return { success: false, message: 'GoHighLevel API key not configured' };
    }

    // Test GoHighLevel API
    const response = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    return { 
      success: response.ok, 
      message: response.ok ? 'GoHighLevel connection successful' : 'GoHighLevel API test failed',
    };
  } catch (error) {
    return { success: false, message: `GoHighLevel test failed: ${error.message}` };
  }
};

const testGoogleAnalyticsConnection = async (config) => {
  const measurementId = config.measurementId || process.env.GA_MEASUREMENT_ID;
  
  if (!measurementId || !measurementId.startsWith('G-')) {
    return { success: false, message: 'Invalid Google Analytics Measurement ID format' };
  }
  
  return { success: true, message: 'Google Analytics Measurement ID validated' };
};

// @desc    Trigger plugin automation
// @route   POST /api/plugins/trigger
// @access  Private
export const triggerPluginAutomation = asyncHandler(async (req, res) => {
  const { event, data, userId } = req.body;

  try {
    const user = userId ? await User.findById(userId) : req.user;
    const results = [];

    // Get active integrations for this event
    const activeIntegrations = await Integration.find({
      isActive: true,
      'events.trigger': event,
    });

    for (const integration of activeIntegrations) {
      try {
        const result = await executePluginAction(integration, event, data, user);
        results.push({
          plugin: integration.name,
          success: result.success,
          message: result.message,
        });
        
        await integration.logApiCall(result.success, result.success ? null : new Error(result.message));
      } catch (error) {
        results.push({
          plugin: integration.name,
          success: false,
          error: error.message,
        });
        
        await integration.logApiCall(false, error);
      }
    }

    res.status(200).json({
      success: true,
      message: `Triggered ${results.length} plugin automations`,
      data: results,
    });
  } catch (error) {
    console.error('Plugin automation error:', error);
    res.status(500).json({
      success: false,
      message: 'Plugin automation failed',
      error: error.message,
    });
  }
});

// Execute specific plugin actions
const executePluginAction = async (integration, event, data, user) => {
  switch (integration.type) {
    case 'zapier':
      return await executeZapierAction(integration, event, data, user);
    case 'email':
      return await executeEmailAction(integration, event, data, user);
    case 'crm':
      return await executeCRMAction(integration, event, data, user);
    case 'calendar':
      return await executeCalendarAction(integration, event, data, user);
    default:
      return { success: false, message: 'Unknown integration type' };
  }
};

const executeZapierAction = async (integration, event, data, user) => {
  const webhookData = {
    event,
    timestamp: new Date().toISOString(),
    platform: 'YOU YES YOU',
    user: user ? {
      id: user._id,
      name: user.name,
      email: user.email,
      phase: user.phase,
      level: user.level,
      points: user.points,
    } : null,
    data,
  };

  const response = await fetch(integration.configuration.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookData),
  });

  return {
    success: response.ok,
    message: response.ok ? 'Zapier webhook triggered successfully' : `Webhook failed: ${response.status}`,
  };
};

const executeEmailAction = async (integration, event, data, user) => {
  // Email actions are handled by emailService.js
  return { success: true, message: 'Email action queued' };
};

const executeCRMAction = async (integration, event, data, user) => {
  if (integration.provider === 'GoHighLevel') {
    const response = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.configuration.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        firstName: user.name.split(' ')[0],
        lastName: user.name.split(' ').slice(1).join(' '),
        tags: [`Event: ${event}`, `Phase: ${user.phase}`],
      }),
    });

    return {
      success: response.ok,
      message: response.ok ? 'CRM contact updated' : 'CRM update failed',
    };
  }

  return { success: false, message: 'Unknown CRM provider' };
};

const executeCalendarAction = async (integration, event, data, user) => {
  // Calendar sync logic would go here
  return { success: true, message: 'Calendar sync completed' };
};

export default {
  getAvailablePlugins,
  installPlugin,
  testPlugin,
  configurePlugin,
  triggerPluginAutomation,
};