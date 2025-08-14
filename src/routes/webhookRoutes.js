import express from 'express';
import {
  handleZapierWebhook,
  handleGoogleCalendarWebhook,
  handleStripeWebhook,
} from '../controllers/webhookController.js';

const router = express.Router();

// Webhook authentication middleware
const authenticateWebhook = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers.authorization?.split(' ')[1];
  const validApiKey = process.env.PLATFORM_API_KEY;

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({
      success: false,
      message: 'Invalid webhook authentication',
    });
  }

  next();
};

// Zapier webhooks
router.post('/zapier/:event', authenticateWebhook, handleZapierWebhook);

// Google Calendar webhooks  
router.post('/google-calendar', authenticateWebhook, handleGoogleCalendarWebhook);

// Stripe webhooks (uses Stripe signature verification)
router.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router;