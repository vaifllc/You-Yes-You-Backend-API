import User from '../models/User.js';
import { Message, Conversation } from '../models/Message.js';
import Notification from '../models/Notification.js';

// Auto-message templates
const AUTO_MESSAGES = {
  welcome: {
    subject: 'Welcome to YOU YES YOU! 👋',
    message: `🎉 **Welcome to the YOU YES YOU Community, {name}!**

I'm excited to have you join our brotherhood of formerly incarcerated fathers committed to transformation and growth.

**Here's how to get started:**

🔸 **Complete your profile** - Tell us about yourself and your journey
🔸 **Start the onboarding course** - "Foundations of Personal Growth" 
🔸 **Make your first post** - Introduce yourself in General Discussion
🔸 **Connect with others** - Send connection requests to fellow members
🔸 **Join upcoming events** - Check the calendar for live sessions

**Your First Week Goals:**
• Complete your profile (+15 points)
• Make your first post (+10 points) 
• Comment on 3 posts (+15 points)
• RSVP to an event (+5 points)
• Login daily for 7 days (+14 points + streak bonus)

Remember: You belong here, you have value, and your story isn't over. We're here to support you every step of the way.

**Questions?** Just reply to this message or ask in the General Discussion. Our community is here to help!

Welcome to the brotherhood! 💪

**Marcus Johnson**
*Community Leader & Founder*`,
    delay: 0, // Send immediately
  },

  day3_checkin: {
    subject: 'How are you settling in? 🤔',
    message: `Hey {name}! 👋

You've been part of the YOU YES YOU community for 3 days now. How are you settling in?

**Quick check-in:**
• Have you completed your profile?
• Did you make your first post yet?
• Any questions about how things work?

**This week's focus:** Getting comfortable and finding your rhythm in the community.

**Need help?** 
• Check out our [Community Guidelines](/guidelines)
• Ask questions in the Q&A section
• Connect with other members in your phase

You're doing great! Keep showing up - consistency is key to transformation.

**Cheering you on,**
**The YOU YES YOU Team** 📈`,
    delay: 3, // 3 days after joining
  },

  week1_progress: {
    subject: 'Your first week - amazing progress! 🚀',
    message: `🎉 **One week down, {name}!**

You've been part of the YOU YES YOU community for a full week. That's something to celebrate!

**Your week by the numbers:**
• Points earned: {points}
• Current level: {level}
• Posts created: {posts}
• Comments made: {comments}
• Events attended: {events}

**Keep the momentum going:**
• Join a challenge to build positive habits
• Connect with 2-3 members this week
• Complete your first course module
• Share a win (big or small) with the community

**Remember:** Progress over perfection. Every small step matters on this journey.

**What's next?** Focus on one course module this week and engage with other members' posts.

**You've got this!** 💪
**The YOU YES YOU Team**`,
    delay: 7, // 1 week after joining
  },

  month1_milestone: {
    subject: 'One month milestone - you\'re building something special! 🌟',
    message: `🏆 **30 days of transformation, {name}!**

A full month in the YOU YES YOU community! This is a major milestone worth celebrating.

**Your growth so far:**
• Total points: {points}
• Current level: {level}
• Courses progress: {courseProgress}
• Community connections: {connections}
• Login streak: {loginStreak} days

**You're building:**
✓ Consistency and discipline
✓ New knowledge and skills  
✓ Meaningful relationships
✓ A foundation for lasting change

**This month's challenge:** 
Focus on deepening one relationship in the community. Reach out to someone you've connected with and offer support or ask for guidance.

**Looking ahead:** What's one goal you want to achieve in your next 30 days? Share it in the community for accountability!

**Proud of your progress,**
**Marcus Johnson & The YOU YES YOU Team** 🎯`,
    delay: 30, // 1 month after joining
  },

  course_completion: {
    subject: 'Course completed - you\'re on fire! 🔥',
    message: `🎓 **Congratulations, {name}!**

You just completed **{courseTitle}** - that's huge! 

**This achievement shows:**
• Your commitment to growth
• Your investment in yourself
• Your dedication to change

**You earned:**
• +50 points for course completion
• Digital certificate (check your email)
• New badge: "Course Completionist"

**What's next?**
• Share your biggest takeaway in the Wins section
• Apply what you learned in your daily life
• Help other members who are taking this course
• Consider starting the next course in your phase

**Keep this momentum going!** The habits you're building now will transform your life.

**Celebrating your success,**
**The YOU YES YOU Team** 📚`,
    delay: 0, // Send immediately when triggered
  },
};

// Send auto-message to new member
export const sendWelcomeMessage = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const template = AUTO_MESSAGES.welcome;
    const personalizedMessage = template.message.replace(/{name}/g, user.name);

    // Create system notification
    await Notification.create({
      recipient: userId,
      type: 'welcome',
      title: template.subject,
      message: personalizedMessage,
      priority: 'high',
      icon: '👋',
    });

    // Send email version
    const { sendAutoWelcomeDM } = await import('./emailService.js');
    await sendAutoWelcomeDM(user);

    console.log(`✅ Welcome message sent to ${user.name}`);
  } catch (error) {
    console.error('❌ Failed to send welcome message:', error);
  }
};

// Send milestone check-in messages
export const sendMilestoneMessages = async () => {
  try {
    const now = new Date();
    
    // 3-day check-in
    const day3Users = await User.find({
      createdAt: {
        $gte: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        $lte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
    });

    // 1-week check-in
    const week1Users = await User.find({
      createdAt: {
        $gte: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
        $lte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
    });

    // 1-month milestone
    const month1Users = await User.find({
      createdAt: {
        $gte: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000),
        $lte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Send 3-day check-ins
    for (const user of day3Users) {
      const template = AUTO_MESSAGES.day3_checkin;
      const message = template.message.replace(/{name}/g, user.name);

      await Notification.create({
        recipient: user._id,
        type: 'system',
        title: template.subject,
        message,
        priority: 'normal',
        icon: '💭',
      });
    }

    // Send 1-week progress messages
    for (const user of week1Users) {
      const template = AUTO_MESSAGES.week1_progress;
      let message = template.message
        .replace(/{name}/g, user.name)
        .replace(/{points}/g, user.points)
        .replace(/{level}/g, user.level);

      // Get user stats
      const Post = (await import('../models/Post.js')).default;
      const Event = (await import('../models/Event.js')).default;
      
      const userPosts = await Post.countDocuments({ author: user._id });
      const userEvents = await Event.countDocuments({ 'attendees.user': user._id });
      
      message = message
        .replace(/{posts}/g, userPosts)
        .replace(/{comments}/g, 'several') // Could calculate actual comment count
        .replace(/{events}/g, userEvents);

      await Notification.create({
        recipient: user._id,
        type: 'system',
        title: template.subject,
        message,
        priority: 'normal',
        icon: '🚀',
      });
    }

    // Send 1-month milestone messages
    for (const user of month1Users) {
      const template = AUTO_MESSAGES.month1_milestone;
      let message = template.message
        .replace(/{name}/g, user.name)
        .replace(/{points}/g, user.points)
        .replace(/{level}/g, user.level);

      // Calculate additional stats
      const courseProgress = user.courses.length > 0 
        ? `${user.courses.filter(c => c.progress === 100).length}/${user.courses.length} completed`
        : 'No courses started yet';
      
      const Connection = (await import('../models/Connection.js')).default;
      const connections = await Connection.countDocuments({
        $or: [{ requester: user._id }, { recipient: user._id }],
        status: 'accepted',
      });

      message = message
        .replace(/{courseProgress}/g, courseProgress)
        .replace(/{connections}/g, connections)
        .replace(/{loginStreak}/g, user.streaks?.login?.current || 0);

      await Notification.create({
        recipient: user._id,
        type: 'system',
        title: template.subject,
        message,
        priority: 'high',
        icon: '🌟',
      });
    }

    console.log(`✅ Sent milestone messages: ${day3Users.length} 3-day, ${week1Users.length} 1-week, ${month1Users.length} 1-month`);
    
    return {
      day3Sent: day3Users.length,
      week1Sent: week1Users.length,
      month1Sent: month1Users.length,
    };
  } catch (error) {
    console.error('❌ Failed to send milestone messages:', error);
    return null;
  }
};

// Send course completion message
export const sendCourseCompletionMessage = async (userId, course) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const { sendCourseCompletionMessage } = await import('./emailService.js');
    const template = AUTO_MESSAGES.course_completion;
    const message = template.message
      .replace(/{name}/g, user.name)
      .replace(/{courseTitle}/g, course.title);

    await Notification.create({
      recipient: userId,
      type: 'system',
      title: template.subject,
      message,
      priority: 'high',
      icon: '🎓',
    });
    
    // Send email notification
    await sendCourseCompletionMessage(user, course);

    console.log(`✅ Course completion message sent to ${user.name} for ${course.title}`);
  } catch (error) {
    console.error('❌ Failed to send course completion message:', error);
  }
};

// Schedule daily auto-messaging job
export const scheduleDailyAutoMessages = () => {
  // Run milestone messages every day at 10 AM
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 10) { // 10 AM
      await sendMilestoneMessages();
    }
  }, 60 * 60 * 1000); // Check every hour

  console.log('📅 Auto-messaging scheduler started');
};

export default {
  sendWelcomeMessage,
  sendMilestoneMessages,
  sendCourseCompletionMessage,
  scheduleDailyAutoMessages,
};