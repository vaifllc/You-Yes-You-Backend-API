import { asyncHandler } from '../middleware/errorHandler.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Course from '../models/Course.js';
import Event from '../models/Event.js';
import Resource from '../models/Resource.js';

// Chatbot knowledge base and responses
const CHATBOT_RESPONSES = {
  greetings: [
    "Hello! I'm here to help you navigate the YOU YES YOU community. What can I assist you with today?",
    "Welcome, brother! How can I support your journey today?",
    "Hey there! I'm your community assistant. What would you like to know?",
  ],
  
  help_topics: {
    getting_started: {
      keywords: ['start', 'begin', 'new', 'onboarding', 'first'],
      response: `Here's how to get started in the YOU YES YOU community:

1. **Complete your profile** - Add your bio, location, and skills
2. **Start the onboarding course** - "Foundations of Personal Growth"
3. **Make your first post** - Introduce yourself in General Discussion
4. **Connect with others** - Send connection requests to fellow members
5. **Join events** - Check the calendar for upcoming sessions

Need help with any of these steps? Just ask!`,
    },
    
    points_system: {
      keywords: ['points', 'level', 'levels', 'gamification', 'earn', 'score'],
      response: `Here's how you earn points in our community:

**Daily Activities:**
• Daily Login: +2 points
• Create Post: +5 points
• Comment on Post: +3 points
• Like Post: +1 point

**Learning & Growth:**
• Complete Module: +10 points
• Complete Course: +50 points
• Attend Event: +15 points
• RSVP to Event: +5 points

**Special Actions:**
• Share Win: +20 points
• Complete Challenge: +25 points
• Help Another Member: +15 points

**Levels:** New Member (0-99) → Builder (100-249) → Overcomer (250-499) → Mentor-in-Training (500-749) → Legacy Leader (750+)`,
    },
    
    phases: {
      keywords: ['phase', 'phases', 'program', 'curriculum'],
      response: `The YOU YES YOU program has 3 phases:

**Phase 1: Personal Development** (8-12 weeks)
• Self-awareness and mindset transformation
• Goal setting and accountability
• Personal growth foundations

**Phase 2: Financial Literacy** (10-14 weeks)
• Budgeting and saving strategies
• Credit repair techniques
• Investment basics and financial planning

**Phase 3: Entrepreneurship** (12-16 weeks)
• Business planning and strategy
• Marketing and sales fundamentals
• Operations management and leadership

Each phase builds on the previous one to create lasting transformation.`,
    },
    
    connections: {
      keywords: ['connect', 'connection', 'friend', 'network', 'mentorship', 'accountability'],
      response: `You can make three types of connections:

**🤝 Brotherhood Connection**
General community support and friendship

**🎯 Mentorship & Guidance**
Learn from someone with more experience

**⚡ Accountability Partner**
Mutual goal tracking and motivation

To connect with someone:
1. Go to their profile
2. Click "Send Connection Request"
3. Choose your connection type
4. Add a personal message
5. Send the request

Remember to be authentic and respectful in your approach!`,
    },
    
    courses: {
      keywords: ['course', 'courses', 'learn', 'education', 'class', 'module'],
      response: `Our learning platform offers courses for each phase:

**Phase 1 Courses:**
• Foundations of Personal Growth
• Communication Skills
• Goal Setting & Accountability

**Phase 2 Courses:**
• Financial Literacy Fundamentals
• Budgeting & Saving Strategies
• Credit Repair & Building

**Phase 3 Courses:**
• Entrepreneurship Essentials
• Business Planning
• Marketing & Sales

You can track your progress, earn points for completion, and get certificates!`,
    },
    
    resources: {
      keywords: ['resource', 'resources', 'help', 'housing', 'job', 'legal', 'support'],
      response: `Our resource directory includes help for:

**Essential Services:**
• Housing (transitional & permanent)
• Employment (job boards & training)
• Legal Aid (expungement & rights)
• Mental Health (counseling & support)

**Support Services:**
• Financial Services (banking & credit)
• Healthcare (clinics & insurance)
• Education (GED & vocational training)
• Transportation (public transit & vehicle programs)

**Emergency Support:**
• Food Assistance
• Emergency Services
• Crisis Hotlines

Browse the resources section or search by category to find what you need!`,
    },
    
    events: {
      keywords: ['event', 'events', 'calendar', 'meeting', 'session', 'workshop'],
      response: `We host regular community events:

**Weekly Events:**
• Community Q&A Sessions
• Accountability Check-ins
• Guest Speaker Series

**Monthly Events:**
• Phase-specific Workshops
• Skill-building Sessions
• Networking Mixers

**Special Events:**
• Graduation Ceremonies
• Success Story Spotlights
• Family Fun Activities

Check the calendar to see upcoming events and RSVP to join!`,
    },
    
    challenges: {
      keywords: ['challenge', 'challenges', 'daily', 'weekly', 'monthly', 'habit'],
      response: `Join our community challenges to build positive habits:

**Current Challenges:**
• 30-Day Morning Routine Challenge
• 7-Day Gratitude Challenge
• Weekly Fitness Challenge
• Monthly Reading Challenge

**Benefits:**
• Earn bonus points and badges
• Build lasting habits
• Connect with other participants
• Track your progress publicly

Challenges help you stay accountable and motivated on your journey!`,
    },
  },
  
  fallback: [
    "I'm not sure about that specific question, but I'm here to help! You can ask me about getting started, earning points, the 3-phase program, making connections, courses, resources, events, or challenges.",
    "That's a great question! While I don't have that specific information, you can try asking in the General Discussion or contact our community team. Is there something else I can help with?",
    "I'd love to help you with that! For specific questions like this, I recommend posting in our Q&A section where other members and moderators can assist. What else can I help you with today?",
  ],
};

// @desc    Handle chatbot conversation
// @route   POST /api/chatbot/message
// @access  Private
export const handleChatbotMessage = asyncHandler(async (req, res) => {
  const { message, conversationId } = req.body;
  const userId = req.user._id;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message is required',
    });
  }

  try {
    // Analyze user message and determine response
    const response = await generateChatbotResponse(message.toLowerCase(), userId);
    
    // Log chatbot interaction
    console.log(`🤖 Chatbot interaction - User: ${req.user.username}, Message: "${message}"`);

    res.status(200).json({
      success: true,
      data: {
        message: response,
        timestamp: new Date(),
        conversationId: conversationId || `chatbot_${userId}_${Date.now()}`,
        type: 'chatbot_response',
      },
    });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({
      success: false,
      message: 'Chatbot service temporarily unavailable',
    });
  }
});

// Generate contextual chatbot response
const generateChatbotResponse = async (message, userId) => {
  try {
    // Check for greetings first
    const greetingWords = ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon'];
    if (greetingWords.some(word => message.includes(word))) {
      return getRandomResponse(CHATBOT_RESPONSES.greetings);
    }

    // Check each help topic
    for (const [topic, data] of Object.entries(CHATBOT_RESPONSES.help_topics)) {
      if (data.keywords.some(keyword => message.includes(keyword))) {
        return data.response;
      }
    }

    // Handle specific user data requests
    if (message.includes('my points') || message.includes('my score')) {
      const user = await User.findById(userId).select('points level');
      return `You currently have **${user.points} points** and you're at the **${user.level}** level! ${getEncouragement(user.points)}`;
    }

    if (message.includes('my courses') || message.includes('my progress')) {
      const user = await User.findById(userId).populate('courses.courseId', 'title');
      const enrolledCount = user.courses.length;
      const completedCount = user.courses.filter(c => c.progress === 100).length;
      
      return `You're enrolled in **${enrolledCount} courses** and have completed **${completedCount}** of them. ${enrolledCount === 0 ? 'Ready to start learning? Check out our course catalog!' : 'Keep up the great work!'}`;
    }

    if (message.includes('my connections') || message.includes('network')) {
      const Connection = (await import('../models/Connection.js')).default;
      const connections = await Connection.countDocuments({
        $or: [
          { requester: userId },
          { recipient: userId },
        ],
        status: 'accepted',
      });
      
      return `You have **${connections} active connections** in the community. ${connections === 0 ? 'Start building your network by sending connection requests to other members!' : 'Great job building your network!'}`;
    }

    // Handle questions about specific features
    if (message.includes('how do i') || message.includes('how to')) {
      if (message.includes('post') || message.includes('share')) {
        return `To create a post:
1. Go to the Community section
2. Click "Create Post"
3. Choose a category
4. Write your content
5. Add tags (optional)
6. Click "Post"

Remember to keep it positive and supportive! You'll earn 5 points for each post.`;
      }
      
      if (message.includes('connect') || message.includes('friend')) {
        return `To connect with someone:
1. Visit their profile
2. Click "Send Connection Request"
3. Choose: Brotherhood, Mentorship, or Accountability
4. Add a personal message
5. Send the request

Be authentic about why you want to connect!`;
      }
    }

    // Default fallback response
    return getRandomResponse(CHATBOT_RESPONSES.fallback);
    
  } catch (error) {
    console.error('Error generating chatbot response:', error);
    return "I'm having trouble processing your request right now. Please try again or ask in the General Discussion for help from other members.";
  }
};

// Helper functions
const getRandomResponse = (responses) => {
  return responses[Math.floor(Math.random() * responses.length)];
};

const getEncouragement = (points) => {
  if (points < 50) return "You're just getting started - every point counts! 🌱";
  if (points < 150) return "You're building momentum - keep it up! 🚀";
  if (points < 300) return "You're making real progress - awesome work! 💪";
  if (points < 600) return "You're becoming a community leader - inspiring! ⭐";
  return "You're a true legacy leader - thank you for inspiring others! 👑";
};

// @desc    Get chatbot help topics
// @route   GET /api/chatbot/topics
// @access  Private
export const getChatbotTopics = asyncHandler(async (req, res) => {
  const topics = Object.keys(CHATBOT_RESPONSES.help_topics).map(key => ({
    id: key,
    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    keywords: CHATBOT_RESPONSES.help_topics[key].keywords,
  }));

  res.status(200).json({
    success: true,
    data: {
      topics,
      suggestions: [
        "How do I get started?",
        "Tell me about the point system",
        "What are the 3 phases?",
        "How do I connect with others?",
        "What courses are available?",
        "What resources do you have?",
        "When are the next events?",
        "What challenges can I join?",
        "Show me my points",
        "What are my courses?",
      ],
    },
  });
});

// @desc    Get chatbot conversation history
// @route   GET /api/chatbot/history
// @access  Private
export const getChatbotHistory = asyncHandler(async (req, res) => {
  // For now, return empty history - in production you'd store chat logs
  res.status(200).json({
    success: true,
    data: {
      conversations: [],
      message: "Chatbot history feature coming soon!",
    },
  });
});

export default {
  handleChatbotMessage,
  getChatbotTopics,
  getChatbotHistory,
};