import express from 'express';
import Event from '../models/Event.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  validateEvent,
  validateObjectId,
  validatePagination,
  handleValidationErrors,
} from '../middleware/validation.js';
import { param } from 'express-validator';
import {
  logEventJoined
} from '../middleware/activityLogger.js';

const router = express.Router();

// @desc    Get all events
// @route   GET /api/events
// @access  Public
router.get('/', optionalAuth, validatePagination, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    type,
    phase,
    status = 'scheduled',
    upcoming = false,
    search
  } = req.query;

  // Build query
  const query = { status };

  if (type && type !== 'all') {
    query.type = type;
  }

  if (phase && phase !== 'all') {
    query.phase = phase;
  }

  if (upcoming === 'true') {
    query.date = { $gte: new Date() };
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { instructor: { $regex: search, $options: 'i' } },
    ];
  }

  // Execute query with pagination
  const events = await Event.find(query)
    .sort({ date: 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Add attendance status for authenticated users
  if (req.user) {
    events.forEach(event => {
      event.isUserAttending = event.attendees?.some(
        attendee => attendee.user.toString() === req.user._id.toString() &&
                   attendee.status === 'going'
      ) || false;

      event.userRSVPStatus = event.attendees?.find(
        attendee => attendee.user.toString() === req.user._id.toString()
      )?.status || null;
    });
  }

  // Get total count for pagination
  const total = await Event.countDocuments(query);

  res.status(200).json({
    success: true,
    data: events,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
}));

// NOTE: Place static routes before parameterized :id to avoid collisions (e.g., /my-events)
// @desc    Get user's events
// @route   GET /api/events/my-events
// @access  Private
router.get('/my-events', authenticate, asyncHandler(async (req, res) => {
  const { upcoming = true } = req.query;

  const query = {
    'attendees.user': req.user._id,
    'attendees.status': 'going',
  };

  if (upcoming === 'true') {
    query.date = { $gte: new Date() };
  }

  const events = await Event.find(query)
    .sort({ date: 1 });

  res.status(200).json({
    success: true,
    data: events,
  });
}));

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
router.get('/:id', validateObjectId, optionalAuth, asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id)
    .populate('attendees.user', 'name username avatar level')
    .populate('feedback.user', 'name username avatar');

  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found',
    });
  }

  // Check user attendance status
  let isUserAttending = false;
  let userRSVPStatus = null;

  if (req.user) {
    const userRSVP = event.attendees.find(
      attendee => attendee.user._id.toString() === req.user._id.toString()
    );

    if (userRSVP) {
      isUserAttending = userRSVP.status === 'going';
      userRSVPStatus = userRSVP.status;
    }
  }

  res.status(200).json({
    success: true,
    data: {
      ...event.toJSON(),
      isUserAttending,
      userRSVPStatus,
    },
  });
}));

// @desc    RSVP to event
// @route   PUT /api/events/:id/rsvp
// @access  Private
router.put('/:id/rsvp', authenticate, validateObjectId, logEventJoined, asyncHandler(async (req, res) => {
  const { status } = req.body; // 'going', 'maybe', 'not_going'

  if (!['going', 'maybe', 'not_going'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid RSVP status',
    });
  }

  const event = await Event.findById(req.params.id);

  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found',
    });
  }

  // Check if event is full (for 'going' status)
  if (status === 'going' && event.maxAttendees) {
    const goingCount = event.attendees.filter(a => a.status === 'going').length;
    if (goingCount >= event.maxAttendees) {
      return res.status(400).json({
        success: false,
        message: 'Event is full',
      });
    }
  }

  // Update RSVP
  await event.addAttendee(req.user._id, status);

  // Award points for RSVPing
  if (status === 'going') {
    await req.user.addPoints(5, `RSVP'd to ${event.title}`);
  }

  res.status(200).json({
    success: true,
    message: `RSVP updated to ${status}`,
    data: {
      status,
      attendeeCount: event.attendeeCount,
      spotsRemaining: event.spotsRemaining,
    },
  });
}));

// (moved above to avoid /:id catching /my-events)

// Admin routes - must authenticate before role check
router.use(authenticate, authorize('admin'));

// @desc    Create new event
// @route   POST /api/events
// @access  Private (Admin)
router.post('/', validateEvent, handleValidationErrors, asyncHandler(async (req, res) => {
  const event = await Event.create(req.body);

  res.status(201).json({
    success: true,
    message: 'Event created successfully',
    data: event,
  });
}));

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private (Admin)
router.put('/:id', validateObjectId, validateEvent, handleValidationErrors, asyncHandler(async (req, res) => {
  const event = await Event.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Event updated successfully',
    data: event,
  });
}));

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private (Admin)
router.delete('/:id', validateObjectId, asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found',
    });
  }

  await Event.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Event deleted successfully',
  });
}));

// @desc    Mark attendance
// @route   PUT /api/events/:id/attendance
// @access  Private (Admin)
router.put('/:id/attendance', validateObjectId, asyncHandler(async (req, res) => {
  const { userId, attended } = req.body;

  const event = await Event.findById(req.params.id);

  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found',
    });
  }

  await event.markAttendance(userId, attended);

  // Award points for attendance
  if (attended) {
    const user = await User.findById(userId);
    if (user) {
      await user.addPoints(event.points || 15, `Attended ${event.title}`);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Attendance updated successfully',
  });
}));

export default router;