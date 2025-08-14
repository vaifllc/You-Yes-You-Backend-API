import { asyncHandler } from '../middleware/errorHandler.js';
import Event from '../models/Event.js';
import User from '../models/User.js';
import { sendEventReminderEmail } from '../utils/emailService.js';

// @desc    Sync with Google Calendar
// @route   POST /api/calendar/sync
// @access  Private (Admin)
export const syncGoogleCalendar = asyncHandler(async (req, res) => {
  const { calendarId, timeMin, timeMax } = req.body;

  try {
    const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Google Calendar API key not configured',
      });
    }

    // Fetch events from Google Calendar
    const params = new URLSearchParams({
      key: apiKey,
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`
    );

    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.status}`);
    }

    const calendarData = await response.json();
    const syncedEvents = [];

    // Process each calendar event
    for (const googleEvent of calendarData.items || []) {
      try {
        const eventData = {
          title: googleEvent.summary || 'Untitled Event',
          description: googleEvent.description || '',
          date: new Date(googleEvent.start.dateTime || googleEvent.start.date),
          duration: calculateEventDuration(googleEvent.start, googleEvent.end),
          type: determineEventType(googleEvent.summary),
          phase: 'All Phases',
          status: 'scheduled',
          googleCalendarId: googleEvent.id,
          googleCalendarLink: googleEvent.htmlLink,
        };

        // Create or update event in our database
        const event = await Event.findOneAndUpdate(
          { googleCalendarId: googleEvent.id },
          eventData,
          { upsert: true, new: true }
        );

        syncedEvents.push(event);
      } catch (eventError) {
        console.error(`Error processing event ${googleEvent.id}:`, eventError);
      }
    }

    res.status(200).json({
      success: true,
      message: `Synced ${syncedEvents.length} events from Google Calendar`,
      data: {
        syncedCount: syncedEvents.length,
        events: syncedEvents,
      },
    });

  } catch (error) {
    console.error('Google Calendar sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Calendar sync failed',
      error: error.message,
    });
  }
});

// @desc    Export events to Google Calendar
// @route   POST /api/calendar/export/:eventId
// @access  Private (Admin)
export const exportToGoogleCalendar = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.eventId);

  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found',
    });
  }

  try {
    const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Google Calendar API not configured',
      });
    }

    // Prepare event data for Google Calendar
    const endDate = new Date(event.date.getTime() + parseDuration(event.duration));
    
    const googleEventData = {
      summary: event.title,
      description: `${event.description}\n\n🔗 YOU YES YOU Community Event\n📋 Type: ${event.type}\n👨‍🏫 Instructor: ${event.instructor}`,
      start: {
        dateTime: event.date.toISOString(),
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'America/New_York',
      },
      attendees: event.attendees.map(attendee => ({
        email: attendee.user.email,
        responseStatus: attendee.status === 'going' ? 'accepted' : 'tentative',
      })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24 hours
          { method: 'popup', minutes: 60 }, // 1 hour
        ],
      },
    };

    // Create event in Google Calendar
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(googleEventData),
      }
    );

    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.status}`);
    }

    const createdEvent = await response.json();

    // Update our event with Google Calendar ID
    event.googleCalendarId = createdEvent.id;
    event.googleCalendarLink = createdEvent.htmlLink;
    await event.save();

    res.status(200).json({
      success: true,
      message: 'Event exported to Google Calendar',
      data: {
        googleEventId: createdEvent.id,
        googleEventLink: createdEvent.htmlLink,
      },
    });

  } catch (error) {
    console.error('Google Calendar export error:', error);
    res.status(500).json({
      success: false,
      message: 'Calendar export failed',
      error: error.message,
    });
  }
});

// @desc    Schedule event reminders
// @route   POST /api/calendar/schedule-reminders
// @access  Private (Admin)
export const scheduleEventReminders = asyncHandler(async (req, res) => {
  try {
    const upcomingEvents = await Event.find({
      date: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
      },
      status: 'scheduled',
    }).populate('attendees.user', 'name email');

    let remindersSent = 0;

    for (const event of upcomingEvents) {
      const eventDate = new Date(event.date);
      const now = new Date();
      const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Send reminder if event is 24 hours away (with 1 hour buffer)
      if (hoursUntilEvent <= 25 && hoursUntilEvent >= 23) {
        for (const attendee of event.attendees) {
          if (attendee.status === 'going' && attendee.user) {
            try {
              await sendEventReminderEmail(attendee.user, event);
              remindersSent++;
            } catch (emailError) {
              console.error(`Failed to send reminder to ${attendee.user.email}:`, emailError);
            }
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Processed ${upcomingEvents.length} upcoming events`,
      data: {
        eventsChecked: upcomingEvents.length,
        remindersSent,
      },
    });

  } catch (error) {
    console.error('Event reminder scheduling error:', error);
    res.status(500).json({
      success: false,
      message: 'Reminder scheduling failed',
      error: error.message,
    });
  }
});

// Helper functions
const calculateEventDuration = (start, end) => {
  const startTime = new Date(start.dateTime || start.date);
  const endTime = new Date(end.dateTime || end.date);
  const durationMs = endTime - startTime;
  const durationMinutes = Math.round(durationMs / (1000 * 60));
  
  if (durationMinutes >= 60) {
    const hours = Math.round(durationMinutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `${durationMinutes} min`;
};

const determineEventType = (title) => {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes('workshop')) return 'workshop';
  if (titleLower.includes('q&a') || titleLower.includes('qa')) return 'qa';
  if (titleLower.includes('onboard')) return 'onboarding';
  if (titleLower.includes('mentor')) return 'mentorship';
  if (titleLower.includes('guest')) return 'guest';
  
  return 'community';
};

const parseDuration = (duration) => {
  const match = duration.match(/(\d+)\s*(min|mins|hour|hours)/);
  if (!match) return 60 * 60 * 1000; // Default 1 hour
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  if (unit.startsWith('hour')) {
    return value * 60 * 60 * 1000;
  } else {
    return value * 60 * 1000;
  }
};

export default {
  syncGoogleCalendar,
  exportToGoogleCalendar,
  scheduleEventReminders,
};