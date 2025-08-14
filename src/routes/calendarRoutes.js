import express from 'express';
import {
  syncGoogleCalendar,
  exportToGoogleCalendar,
  scheduleEventReminders,
} from '../controllers/calendarController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { body, param } from 'express-validator';
import { handleValidationErrors, validateObjectId } from '../middleware/validation.js';

const router = express.Router();

// All calendar routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

// @desc    Sync events from Google Calendar
// @route   POST /api/calendar/sync
// @access  Private (Admin)
router.post('/sync', [
  body('calendarId')
    .optional()
    .isString()
    .withMessage('Calendar ID must be a string'),
  body('timeMin')
    .optional()
    .isISO8601()
    .withMessage('Time min must be a valid ISO date'),
  body('timeMax')
    .optional()
    .isISO8601()
    .withMessage('Time max must be a valid ISO date'),
  handleValidationErrors,
], syncGoogleCalendar);

// @desc    Export event to Google Calendar
// @route   POST /api/calendar/export/:eventId
// @access  Private (Admin)
router.post('/export/:eventId', validateObjectId, exportToGoogleCalendar);

// @desc    Schedule event reminders
// @route   POST /api/calendar/schedule-reminders
// @access  Private (Admin)
router.post('/schedule-reminders', scheduleEventReminders);

export default router;