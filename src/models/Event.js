import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxLength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    trim: true,
    maxLength: [2000, 'Description cannot exceed 2000 characters'],
  },
  date: {
    type: Date,
    required: [true, 'Event date is required'],
  },
  duration: {
    type: String,
    required: [true, 'Event duration is required'],
    match: [/^\d+\s(min|mins|hour|hours)$/, 'Duration must be in format "60 min" or "2 hours"'],
  },
  type: {
    type: String,
    required: [true, 'Event type is required'],
    enum: ['workshop', 'qa', 'onboarding', 'mentorship', 'community', 'guest'],
  },
  category: {
    type: String,
    enum: ['Personal Development', 'Financial Literacy', 'Entrepreneurship', 'Community Building'],
  },
  instructor: {
    type: String,
    required: [true, 'Instructor name is required'],
    trim: true,
  },
  instructorBio: String,
  instructorAvatar: {
    type: String,
    default: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  maxAttendees: {
    type: Number,
    min: [1, 'Maximum attendees must be at least 1'],
    max: [1000, 'Maximum attendees cannot exceed 1000'],
  },
  attendees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rsvpDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['going', 'maybe', 'not_going'],
      default: 'going',
    },
    attended: {
      type: Boolean,
      default: false,
    },
  }],
  zoomLink: {
    type: String,
    match: [/^https:\/\/zoom\.us\/j\/\d+/, 'Invalid Zoom link format'],
  },
  meetingId: String,
  passcode: String,
  recordingUrl: String,
  materials: [{
    title: String,
    url: String,
    type: {
      type: String,
      enum: ['pdf', 'video', 'link', 'slides'],
    },
  }],
  tags: [String],
  isRecurring: {
    type: Boolean,
    default: false,
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly'],
    },
    daysOfWeek: [Number], // 0-6, Sunday = 0
    endDate: Date,
  },
  status: {
    type: String,
    enum: ['scheduled', 'live', 'completed', 'cancelled'],
    default: 'scheduled',
  },
  phase: {
    type: String,
    enum: ['Phase 1', 'Phase 2', 'Phase 3', 'All Phases'],
    default: 'All Phases',
  },
  points: {
    type: Number,
    default: 15,
    min: [0, 'Points cannot be negative'],
  },
  reminders: [{
    type: {
      type: String,
      enum: ['1hour', '1day', '1week'],
    },
    sent: {
      type: Boolean,
      default: false,
    },
  }],
  feedback: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    comment: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
});

// Indexes
eventSchema.index({ date: 1 });
eventSchema.index({ type: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ phase: 1 });
eventSchema.index({ 'attendees.user': 1 });

// Virtual for attendee count
eventSchema.virtual('attendeeCount').get(function() {
  return this.attendees ? this.attendees.filter(a => a.status === 'going').length : 0;
});

// Virtual for spots remaining
eventSchema.virtual('spotsRemaining').get(function() {
  if (!this.maxAttendees) return null;
  return this.maxAttendees - this.attendeeCount;
});

// Virtual for average rating
eventSchema.virtual('averageRating').get(function() {
  if (!this.feedback || this.feedback.length === 0) return 0;
  const totalRating = this.feedback.reduce((sum, f) => sum + f.rating, 0);
  return totalRating / this.feedback.length;
});

// Method to check if user is attending
eventSchema.methods.isUserAttending = function(userId) {
  return this.attendees.some(
    attendee => attendee.user.toString() === userId.toString() && attendee.status === 'going'
  );
};

// Method to add attendee
eventSchema.methods.addAttendee = function(userId, status = 'going') {
  // Remove existing RSVP if any
  this.attendees = this.attendees.filter(
    attendee => attendee.user.toString() !== userId.toString()
  );
  
  // Add new RSVP
  if (status !== 'not_going') {
    this.attendees.push({ user: userId, status });
  }
  
  return this.save();
};

// Method to mark attendance
eventSchema.methods.markAttendance = function(userId, attended = true) {
  const attendee = this.attendees.find(
    a => a.user.toString() === userId.toString()
  );
  
  if (attendee) {
    attendee.attended = attended;
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Ensure virtual fields are serialized
eventSchema.set('toJSON', { virtuals: true });

const Event = mongoose.model('Event', eventSchema);

export default Event;