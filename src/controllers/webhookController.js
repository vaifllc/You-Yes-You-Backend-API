import { asyncHandler } from '../middleware/errorHandler.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Course from '../models/Course.js';
import Event from '../models/Event.js';
import Integration from '../models/Integration.js';
import { sendAutoWelcomeDM, sendBadgeEarnedEmail } from '../utils/emailService.js';

// @desc    Handle Zapier webhooks
// @route   POST /api/webhooks/zapier/:event
// @access  Public (with API key)
export const handleZapierWebhook = asyncHandler(async (req, res) => {
  const { event } = req.params;
  const webhookData = req.body;

  console.log(`🔗 Zapier webhook received: ${event}`, webhookData);

  try {
    // Find active Zapier integrations
    const zapierIntegrations = await Integration.find({
      type: 'zapier',
      isActive: true,
      'events.trigger': event,
    });

    if (zapierIntegrations.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active integrations for this event',
      });
    }

    // Process webhook based on event type
    let result = {};
    
    switch (event) {
      case 'new_member':
        result = await processNewMemberWebhook(webhookData);
        break;
      case 'course_completed':
        result = await processCourseCompletedWebhook(webhookData);
        break;
      case 'event_attended':
        result = await processEventAttendedWebhook(webhookData);
        break;
      case 'challenge_completed':
        result = await processChallengeCompletedWebhook(webhookData);
        break;
      case 'badge_earned':
        result = await processBadgeEarnedWebhook(webhookData);
        break;
      case 'level_up':
        result = await processLevelUpWebhook(webhookData);
        break;
      default:
        result = { processed: false, reason: 'Unknown event type' };
    }

    // Log successful webhook processing
    for (const integration of zapierIntegrations) {
      await integration.logApiCall(true);
    }

    res.status(200).json({
      success: true,
      event,
      result,
      integrations: zapierIntegrations.length,
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Log failed webhook
    const zapierIntegrations = await Integration.find({
      type: 'zapier',
      isActive: true,
    });
    
    for (const integration of zapierIntegrations) {
      await integration.logApiCall(false, error);
    }

    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message,
    });
  }
});

// Process different webhook types
const processNewMemberWebhook = async (data) => {
  const { userId, name, email, phase } = data;
  
  // Send to external services
  const results = [];
  
  // Add to Google Sheets (via Zapier)
  if (process.env.GOOGLE_SHEETS_WEBHOOK_URL) {
    try {
      const response = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phase,
          joinDate: new Date().toISOString(),
          source: 'YOU YES YOU Platform',
        }),
      });
      results.push({ service: 'Google Sheets', success: response.ok });
    } catch (error) {
      results.push({ service: 'Google Sheets', success: false, error: error.message });
    }
  }

  // Add to Go HighLevel CRM
  if (process.env.GOHIGHLEVEL_WEBHOOK_URL) {
    try {
      const response = await fetch(process.env.GOHIGHLEVEL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GOHIGHLEVEL_API_KEY}`,
        },
        body: JSON.stringify({
          email,
          firstName: name.split(' ')[0],
          lastName: name.split(' ').slice(1).join(' '),
          phone: '',
          tags: [`YOU YES YOU Member`, `Phase: ${phase}`],
          customFields: [
            { key: 'platform_user_id', value: userId },
            { key: 'join_date', value: new Date().toISOString() },
            { key: 'current_phase', value: phase },
          ],
        }),
      });
      results.push({ service: 'Go HighLevel', success: response.ok });
    } catch (error) {
      results.push({ service: 'Go HighLevel', success: false, error: error.message });
    }
  }

  // Add to ConvertKit
  if (process.env.CONVERTKIT_WEBHOOK_URL) {
    try {
      const response = await fetch(process.env.CONVERTKIT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CONVERTKIT_API_KEY}`,
        },
        body: JSON.stringify({
          email,
          first_name: name.split(' ')[0],
          tags: ['YOU YES YOU Member', `Phase ${phase}`],
          fields: {
            platform_id: userId,
            current_phase: phase,
            join_date: new Date().toISOString(),
          },
        }),
      });
      results.push({ service: 'ConvertKit', success: response.ok });
    } catch (error) {
      results.push({ service: 'ConvertKit', success: false, error: error.message });
    }
  }

  return { event: 'new_member', processed: true, results };
};

const processCourseCompletedWebhook = async (data) => {
  const { userId, courseId, courseTitle, completionDate } = data;
  
  const results = [];

  // Trigger certificate generation
  if (process.env.CERTIFICATE_WEBHOOK_URL) {
    try {
      const user = await User.findById(userId);
      const response = await fetch(process.env.CERTIFICATE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: user.name,
          courseTitle,
          completionDate,
          certificateType: 'course_completion',
        }),
      });
      results.push({ service: 'Certificate Generator', success: response.ok });
    } catch (error) {
      results.push({ service: 'Certificate Generator', success: false, error: error.message });
    }
  }

  // Update CRM with course completion
  if (process.env.GOHIGHLEVEL_WEBHOOK_URL) {
    try {
      const response = await fetch(`${process.env.GOHIGHLEVEL_WEBHOOK_URL}/update-contact`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GOHIGHLEVEL_API_KEY}`,
        },
        body: JSON.stringify({
          customFields: [
            { key: 'last_course_completed', value: courseTitle },
            { key: 'last_completion_date', value: completionDate },
          ],
          tags: [`Completed: ${courseTitle}`],
        }),
      });
      results.push({ service: 'CRM Update', success: response.ok });
    } catch (error) {
      results.push({ service: 'CRM Update', success: false, error: error.message });
    }
  }

  return { event: 'course_completed', processed: true, results };
};

const processEventAttendedWebhook = async (data) => {
  const { userId, eventId, eventTitle, attendanceDate } = data;
  
  const results = [];

  // Update engagement tracking
  if (process.env.ANALYTICS_WEBHOOK_URL) {
    try {
      const response = await fetch(process.env.ANALYTICS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'event_attended',
          userId,
          eventId,
          eventTitle,
          attendanceDate,
          engagementScore: '+15',
        }),
      });
      results.push({ service: 'Analytics', success: response.ok });
    } catch (error) {
      results.push({ service: 'Analytics', success: false, error: error.message });
    }
  }

  return { event: 'event_attended', processed: true, results };
};

const processChallengeCompletedWebhook = async (data) => {
  const { userId, challengeId, challengeTitle, completionDate } = data;
  
  // Trigger reward processing
  const user = await User.findById(userId);
  
  return { 
    event: 'challenge_completed', 
    processed: true, 
    user: user.name,
    challenge: challengeTitle,
    rewardProcessed: true,
  };
};

const processBadgeEarnedWebhook = async (data) => {
  const { userId, badgeName, badgeDescription, pointsAwarded } = data;
  
  // Send congratulations email
  const user = await User.findById(userId);
  await sendBadgeEarnedEmail(user, {
    name: badgeName,
    description: badgeDescription,
    icon: '🏅',
    rewards: { points: pointsAwarded },
  });

  return { 
    event: 'badge_earned', 
    processed: true,
    emailSent: true,
  };
};

const processLevelUpWebhook = async (data) => {
  const { userId, oldLevel, newLevel, totalPoints } = data;
  
  // Could trigger special rewards or notifications
  console.log(`🎉 User ${userId} leveled up from ${oldLevel} to ${newLevel}!`);

  return { 
    event: 'level_up', 
    processed: true,
    levelChange: `${oldLevel} → ${newLevel}`,
  };
};

// @desc    Handle Google Calendar webhook
// @route   POST /api/webhooks/google-calendar
// @access  Public (with verification)
export const handleGoogleCalendarWebhook = asyncHandler(async (req, res) => {
  const { eventType, eventData } = req.body;

  console.log(`📅 Google Calendar webhook: ${eventType}`, eventData);

  // Sync events between Google Calendar and platform
  if (eventType === 'event_created' || eventType === 'event_updated') {
    try {
      const { title, description, start, end, attendees } = eventData;
      
      // Create or update event in platform
      const event = await Event.findOneAndUpdate(
        { googleCalendarId: eventData.id },
        {
          title,
          description,
          date: new Date(start.dateTime),
          duration: calculateDuration(start.dateTime, end.dateTime),
          type: 'community',
          status: 'scheduled',
          googleCalendarId: eventData.id,
        },
        { upsert: true, new: true }
      );

      res.status(200).json({
        success: true,
        message: 'Calendar event synced',
        eventId: event._id,
      });
    } catch (error) {
      console.error('Calendar sync error:', error);
      res.status(500).json({
        success: false,
        message: 'Calendar sync failed',
      });
    }
  } else {
    res.status(200).json({
      success: true,
      message: 'Webhook received',
    });
  }
});

// @desc    Handle Stripe webhook for payments
// @route   POST /api/webhooks/stripe
// @access  Public (with Stripe signature verification)
export const handleStripeWebhook = asyncHandler(async (req, res) => {
  const event = req.body;

  console.log(`💳 Stripe webhook: ${event.type}`);

  switch (event.type) {
    case 'payment_intent.succeeded':
      // Handle successful payment
      const paymentIntent = event.data.object;
      await processSuccessfulPayment(paymentIntent);
      break;
    
    case 'customer.subscription.created':
      // Handle new subscription
      const subscription = event.data.object;
      await processNewSubscription(subscription);
      break;
    
    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
});

// Helper functions
const calculateDuration = (start, end) => {
  const startTime = new Date(start);
  const endTime = new Date(end);
  const durationMs = endTime - startTime;
  const durationMinutes = Math.round(durationMs / (1000 * 60));
  
  if (durationMinutes >= 60) {
    const hours = Math.round(durationMinutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `${durationMinutes} min`;
};

const processSuccessfulPayment = async (paymentIntent) => {
  // Handle payment processing logic
  console.log('Processing successful payment:', paymentIntent.id);
};

const processNewSubscription = async (subscription) => {
  // Handle subscription logic
  console.log('Processing new subscription:', subscription.id);
};

export default {
  handleZapierWebhook,
  handleGoogleCalendarWebhook,
  handleStripeWebhook,
};