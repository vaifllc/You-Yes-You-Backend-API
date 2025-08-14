import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Course from '../models/Course.js';
import Event from '../models/Event.js';
import Resource from '../models/Resource.js';
import Connection from '../models/Connection.js';
import AdminSettings from '../models/AdminSettings.js';
import Challenge from '../models/Challenge.js';
import Badge from '../models/Badge.js';
import Reward from '../models/Reward.js';
import Integration from '../models/Integration.js';
import Notification from '../models/Notification.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected for seeding');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

const seedUsers = async () => {
  console.log('🌱 Seeding users...');

  const users = [
    {
      name: 'Marcus Johnson',
      username: 'marcus_builder',
      email: 'admin@youyesyou.com',
      password: 'Admin123!',
      bio: 'Community leader and founder of YOU YES YOU. Dedicated to helping formerly incarcerated fathers rebuild their lives.',
      location: 'Atlanta, GA',
      phase: 'Phase 3',
      skills: ['Leadership', 'Mentoring', 'Public Speaking', 'Business Development'],
      points: 1250,
      level: 'Legacy Leader',
      role: 'admin',
      avatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=400',
    },
    {
      name: 'David Rodriguez',
      username: 'david_overcomer',
      email: 'david@example.com',
      password: 'User123!',
      bio: 'Father of three, currently in Phase 2. Learning financial literacy and building a better future for my family.',
      location: 'Houston, TX',
      phase: 'Phase 2',
      skills: ['Budgeting', 'Goal Setting', 'Communication'],
      points: 450,
      level: 'Overcomer',
      avatar: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=400',
    },
    {
      name: 'James Wilson',
      username: 'james_mentor',
      email: 'james@example.com',
      password: 'User123!',
      bio: 'Entrepreneur and mentor. Completed all three phases and now helping others on their journey.',
      location: 'Chicago, IL',
      phase: 'Phase 3',
      skills: ['Entrepreneurship', 'Mentoring', 'Sales', 'Leadership'],
      points: 820,
      level: 'Legacy Leader',
      avatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=400',
    },
    {
      name: 'Michael Thompson',
      username: 'mike_builder',
      email: 'michael@example.com',
      password: 'User123!',
      bio: 'New to the community but excited to learn and grow. Father of two amazing kids.',
      location: 'Phoenix, AZ',
      phase: 'Phase 1',
      skills: ['Motivation', 'Fitness'],
      points: 180,
      level: 'Builder',
      avatar: 'https://images.pexels.com/photos/1844643/pexels-photo-1844643.jpeg?auto=compress&cs=tinysrgb&w=400',
    },
    {
      name: 'Robert Brown',
      username: 'rob_rising',
      email: 'robert@example.com',
      password: 'User123!',
      bio: 'Learning every day and committed to being the father my children deserve.',
      location: 'Miami, FL',
      phase: 'Phase 1',
      skills: ['Determination', 'Learning'],
      points: 85,
      level: 'New Member',
      avatar: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=400',
    },
  ];

  await User.deleteMany({});
  const createdUsers = await User.create(users);
  console.log(`✅ Created ${createdUsers.length} users`);
  return createdUsers;
};

const seedCourses = async () => {
  console.log('🌱 Seeding courses...');

  const courses = [
    {
      title: 'Foundations of Personal Growth',
      description: 'Begin your transformation journey with self-awareness, goal setting, and mindset development. This foundational course helps you understand where you are and where you want to go.',
      category: 'Personal Development',
      phase: 'Phase 1',
      level: 'Beginner',
      instructor: 'Marcus Johnson',
      instructorBio: 'Community leader with 10+ years of experience in personal development',
      estimatedDuration: '8-10 weeks',
      isPublished: true,
      enrollmentCount: 45,
      modules: [
        {
          title: 'You. Yes, YOU—Belong Here.',
          description: 'Welcome to the community and understanding your worth',
          duration: '10 min',
          content: 'Module content about belonging and self-worth...',
          order: 1,
        },
        {
          title: 'The Journey Ahead',
          description: 'Overview of the transformation process',
          duration: '15 min',
          content: 'Module content about the journey...',
          order: 2,
        },
        {
          title: 'This Isn\'t Just Another Program',
          description: 'Understanding the unique approach of YOU YES YOU',
          duration: '12 min',
          content: 'Module content about our unique approach...',
          order: 3,
        },
      ],
      skills: ['Self-awareness', 'Goal Setting', 'Mindset'],
      learningObjectives: [
        'Develop self-awareness',
        'Set meaningful goals',
        'Build a growth mindset',
        'Create accountability systems',
      ],
    },
    {
      title: 'Financial Literacy Fundamentals',
      description: 'Master the basics of personal finance, budgeting, saving, and credit repair. Build the foundation for financial independence.',
      category: 'Financial Literacy',
      phase: 'Phase 2',
      level: 'Beginner',
      instructor: 'James Wilson',
      instructorBio: 'Financial advisor and successful entrepreneur',
      estimatedDuration: '10-12 weeks',
      isPublished: true,
      enrollmentCount: 32,
      modules: [
        {
          title: 'Understanding Money Mindset',
          description: 'Changing your relationship with money',
          duration: '20 min',
          content: 'Module content about money mindset...',
          order: 1,
        },
        {
          title: 'Budgeting Basics',
          description: 'Creating and maintaining a personal budget',
          duration: '25 min',
          content: 'Module content about budgeting...',
          order: 2,
        },
      ],
      skills: ['Budgeting', 'Saving', 'Credit Repair'],
      learningObjectives: [
        'Create a personal budget',
        'Understand credit and how to repair it',
        'Develop saving strategies',
        'Plan for financial goals',
      ],
    },
    {
      title: 'Entrepreneurship Essentials',
      description: 'Learn the fundamentals of starting and running a business. From idea validation to operations management.',
      category: 'Entrepreneurship',
      phase: 'Phase 3',
      level: 'Intermediate',
      instructor: 'James Wilson',
      instructorBio: 'Serial entrepreneur with multiple successful ventures',
      estimatedDuration: '12-16 weeks',
      isPublished: true,
      enrollmentCount: 18,
      modules: [
        {
          title: 'Finding Your Business Idea',
          description: 'Discovering opportunities and validating ideas',
          duration: '30 min',
          content: 'Module content about business ideas...',
          order: 1,
        },
      ],
      skills: ['Business Planning', 'Marketing', 'Sales'],
      learningObjectives: [
        'Develop a business plan',
        'Understand basic marketing',
        'Learn sales fundamentals',
        'Manage business operations',
      ],
    },
  ];

  await Course.deleteMany({});
  const createdCourses = await Course.create(courses);
  console.log(`✅ Created ${createdCourses.length} courses`);
  return createdCourses;
};

const seedPosts = async (users) => {
  console.log('🌱 Seeding posts...');

  const posts = [
    {
      author: users[0]._id, // Marcus (Admin)
      content: 'Welcome to YOU YES YOU! This community is built for fathers who are ready to transform their lives and create a better future for their families. Remember: You belong here, you have value, and your story isn\'t over. Let\'s build something amazing together! 💪',
      category: 'Announcements',
      tags: ['welcome', 'community', 'transformation'],
      isPinned: true,
    },
    {
      author: users[1]._id, // David
      content: 'Just completed my first module in the Financial Literacy course! Never thought I\'d understand budgeting, but it\'s starting to click. My kids are going to have a different life because of what I\'m learning here. #FinancialFreedom #Progress',
      category: 'Wins',
      tags: ['financial-literacy', 'progress', 'budgeting'],
    },
    {
      author: users[2]._id, // James
      content: 'Remember kings: every setback is a setup for a comeback. I\'ve been where many of you are right now. The journey isn\'t easy, but it\'s worth it. Keep pushing, keep learning, keep growing. Your family is counting on the man you\'re becoming.',
      category: 'Real Talk',
      tags: ['motivation', 'mindset', 'growth'],
    },
    {
      author: users[3]._id, // Michael
      content: 'Quick question for everyone - what are some good books you\'d recommend for personal development? I\'m really trying to change my mindset and could use some guidance. Thanks in advance, brothers!',
      category: 'Questions',
      tags: ['books', 'personal-development', 'recommendations'],
    },
    {
      author: users[4]._id, // Robert
      content: 'Day 30 of my morning routine challenge! Waking up at 5 AM, exercising, and reading for 30 minutes before the kids wake up. It\'s amazing how much this has changed my entire day. Small wins lead to big victories! 🌅',
      category: 'Challenge Check-Ins',
      tags: ['morning-routine', 'habits', 'discipline'],
    },
  ];

  await Post.deleteMany({});
  const createdPosts = await Post.create(posts);

  // Add some likes and comments
  for (const post of createdPosts) {
    // Add random likes
    const likeCount = Math.floor(Math.random() * 5) + 1;
    for (let i = 0; i < likeCount; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      if (!post.likes.find(like => like.user.toString() === randomUser._id.toString())) {
        post.likes.push({ user: randomUser._id });
      }
    }

    // Add some comments
    const comments = [
      'Great post! Thanks for sharing.',
      'This really resonates with me.',
      'Keep up the excellent work!',
      'Inspiring words, brother.',
      'Thank you for the motivation.',
    ];

    const commentCount = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < commentCount; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomComment = comments[Math.floor(Math.random() * comments.length)];

      post.comments.push({
        user: randomUser._id,
        content: randomComment,
      });
    }

    await post.save();
  }

  console.log(`✅ Created ${createdPosts.length} posts with likes and comments`);
  return createdPosts;
};

const seedEvents = async () => {
  console.log('🌱 Seeding events...');

  const events = [
    {
      title: 'Weekly Community Q&A',
      description: 'Join us for our weekly Q&A session where you can ask questions, share insights, and connect with fellow community members. This is a safe space for open discussion and mutual support.',
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      duration: '90 min',
      type: 'qa',
      category: 'Community Building',
      instructor: 'Marcus Johnson',
      maxAttendees: 50,
      phase: 'All Phases',
      zoomLink: 'https://zoom.us/j/1234567890',
    },
    {
      title: 'Financial Planning Workshop',
      description: 'Learn practical strategies for creating a budget, managing debt, and building savings. Perfect for Phase 2 members but open to all.',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      duration: '2 hours',
      type: 'workshop',
      category: 'Financial Literacy',
      instructor: 'James Wilson',
      maxAttendees: 30,
      phase: 'Phase 2',
      zoomLink: 'https://zoom.us/j/0987654321',
    },
    {
      title: 'New Member Onboarding',
      description: 'Welcome session for new community members. Learn about the platform, meet other members, and get started on your journey.',
      date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      duration: '60 min',
      type: 'onboarding',
      category: 'Community Building',
      instructor: 'Marcus Johnson',
      maxAttendees: 25,
      phase: 'Phase 1',
      zoomLink: 'https://zoom.us/j/1122334455',
    },
  ];

  await Event.deleteMany({});
  const createdEvents = await Event.create(events);
  console.log(`✅ Created ${createdEvents.length} events`);
  return createdEvents;
};

const seedResources = async () => {
  console.log('🌱 Seeding resources...');

  const resources = [
    {
      title: 'Second Chance Apartments',
      description: 'Apartment complexes and housing programs that accept formerly incarcerated individuals. Includes background check friendly options and transitional housing.',
      category: 'Housing',
      type: 'service',
      contact: {
        phone: '1-800-555-0123',
        website: 'https://secondchanceapartments.org',
        email: 'info@secondchanceapartments.org',
      },
      location: 'National',
      tags: ['housing', 'apartments', 'background-friendly'],
      status: 'approved',
      featured: true,
      verified: true,
      eligibility: {
        requirements: ['Valid ID', 'Proof of income'],
        phaseAccess: ['All Phases'],
      },
    },
    {
      title: 'Dave Ramsey Baby Steps Program',
      description: 'Free financial literacy program with 7 proven steps to build wealth and achieve financial peace. Includes budgeting tools and debt payoff strategies.',
      category: 'Financial Services',
      type: 'program',
      contact: {
        website: 'https://daveramsey.com/baby-steps',
      },
      location: 'Online',
      tags: ['budgeting', 'debt-payoff', 'financial-planning'],
      status: 'approved',
      featured: true,
      verified: true,
      eligibility: {
        phaseAccess: ['Phase 2', 'Phase 3'],
      },
    },
    {
      title: 'Legal Aid Society Reentry Program',
      description: 'Free legal assistance for formerly incarcerated individuals. Services include expungement, record sealing, and employment rights advocacy.',
      category: 'Legal Aid',
      type: 'organization',
      contact: {
        phone: '1-800-LEGAL-AID',
        website: 'https://legalaid.org/reentry',
        email: 'reentry@legalaid.org',
      },
      location: 'National',
      tags: ['expungement', 'legal-rights', 'employment-law'],
      status: 'approved',
      verified: true,
      eligibility: {
        requirements: ['Must be formerly incarcerated'],
        phaseAccess: ['All Phases'],
      },
    },
    {
      title: 'Career Builder for Reentry',
      description: 'Job search platform specifically for individuals with criminal backgrounds. Features background-friendly employers and career resources.',
      category: 'Employment',
      type: 'service',
      contact: {
        website: 'https://careerbuilder.com/reentry',
      },
      location: 'Online',
      tags: ['job-search', 'employment', 'background-friendly'],
      status: 'approved',
      featured: true,
      eligibility: {
        phaseAccess: ['All Phases'],
      },
    },
    {
      title: 'NAMI Mental Health Support',
      description: 'National Alliance on Mental Illness provides support groups, resources, and advocacy for mental health. Free support groups available nationwide.',
      category: 'Mental Health',
      type: 'organization',
      contact: {
        phone: '1-800-950-NAMI',
        website: 'https://nami.org',
        email: 'info@nami.org',
      },
      location: 'National',
      tags: ['mental-health', 'support-groups', 'counseling'],
      status: 'approved',
      verified: true,
      eligibility: {
        phaseAccess: ['All Phases'],
      },
    },
  ];

  await Resource.deleteMany({});
  const createdResources = await Resource.create(resources);
  console.log(`✅ Created ${createdResources.length} resources`);
  return createdResources;
};

const seedConnections = async (users) => {
  console.log('🌱 Seeding connections...');

  const connections = [
    {
      requester: users[3]._id, // Michael
      recipient: users[1]._id, // David
      type: 'accountability',
      status: 'accepted',
      message: 'Looking for an accountability partner to help keep me on track!',
      connectionDate: new Date(),
    },
    {
      requester: users[4]._id, // Robert
      recipient: users[2]._id, // James
      type: 'mentorship',
      status: 'accepted',
      message: 'Would love to learn from your entrepreneurship experience.',
      connectionDate: new Date(),
    },
    {
      requester: users[3]._id, // Michael
      recipient: users[0]._id, // Marcus (Admin)
      type: 'brotherhood',
      status: 'pending',
      message: 'Excited to connect with you as part of our YOU YES YOU brotherhood!',
    },
  ];

  await Connection.deleteMany({});
  const createdConnections = await Connection.create(connections);
  console.log(`✅ Created ${createdConnections.length} connections`);
  return createdConnections;
};

const seedAdminSettings = async () => {
  console.log('🌱 Seeding admin settings...');

  const defaultSettings = [
    {
      category: 'general',
      settings: {
        communityName: 'YOU YES YOU',
        communityDescription: 'YOU YES YOU community is a private community for formerly incarcerated fathers committed to personal growth, family restoration, and financial empowerment.',
        welcomeMessage: 'Welcome to YOU YES YOU! We\'re excited to have you join our brotherhood of transformation.',
        primaryColor: '#2563eb',
        secondaryColor: '#16a34a',
        timezone: 'America/New_York',
        language: 'en',
      },
    },
    {
      category: 'moderation',
      settings: {
        autoModeration: {
          enabled: true,
          filterProfanity: true,
          blockSpam: true,
          requireApproval: false,
        },
        contentPolicies: {
          allowImages: true,
          allowLinks: true,
          maxPostLength: 5000,
          maxCommentLength: 1000,
        },
      },
    },
  ];

  await AdminSettings.deleteMany({});

  for (const settingData of defaultSettings) {
    await AdminSettings.create({
      ...settingData,
      updatedBy: null, // System default
    });
  }

  console.log(`✅ Created default admin settings`);
};

const seedChallenges = async () => {
  console.log('🌱 Seeding challenges...');

  const challenges = [
    {
      title: '30-Day Morning Routine Challenge',
      description: 'Build a consistent morning routine that sets you up for success every day. Wake up early, exercise, and start your day with intention.',
      type: 'monthly',
      duration: 30,
      category: 'Personal Development',
      phase: 'All Phases',
      tasks: Array.from({ length: 30 }, (_, i) => ({
        day: i + 1,
        title: `Day ${i + 1}: Morning Routine`,
        description: 'Complete your morning routine: wake up early, exercise, read for 15 minutes',
        isRequired: true,
      })),
      rewards: {
        points: 100,
        badge: {
          name: 'Morning Warrior',
          icon: '🌅',
          description: 'Completed 30-day morning routine challenge',
        },
      },
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
      isPublished: true,
    },
    {
      title: '7-Day Gratitude Challenge',
      description: 'Practice daily gratitude by writing down 3 things you\'re grateful for each day. Focus on family, progress, and opportunities.',
      type: 'weekly',
      duration: 7,
      category: 'Personal Development',
      phase: 'All Phases',
      tasks: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        title: `Day ${i + 1}: Gratitude Practice`,
        description: 'Write down 3 things you\'re grateful for today',
        isRequired: true,
      })),
      rewards: {
        points: 50,
        badge: {
          name: 'Gratitude Master',
          icon: '🙏',
          description: 'Completed 7-day gratitude challenge',
        },
      },
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isActive: true,
      isPublished: true,
    },
  ];

  await Challenge.deleteMany({});

  for (const challengeData of challenges) {
    await Challenge.create({
      ...challengeData,
      createdBy: null, // System challenge
    });
  }

  console.log(`✅ Created ${challenges.length} challenges`);
};

const seedBadges = async () => {
  console.log('🌱 Seeding badges...');

  const badges = [
    {
      name: 'First Post',
      description: 'Made your first community post',
      icon: '📝',
      category: 'Engagement',
      rarity: 'Common',
      criteria: { type: 'posts', value: 1, operator: '>=' },
      rewards: { points: 10 },
    },
    {
      name: 'Rising Star',
      description: 'Earned 100 points',
      icon: '⭐',
      category: 'Achievement',
      rarity: 'Uncommon',
      criteria: { type: 'points', value: 100, operator: '>=' },
      rewards: { points: 20 },
    },
    {
      name: 'Course Completionist',
      description: 'Completed your first course',
      icon: '🎓',
      category: 'Learning',
      rarity: 'Rare',
      criteria: { type: 'courses', value: 1, operator: '>=' },
      rewards: { points: 50 },
    },
    {
      name: 'Community Champion',
      description: 'Top 10 on the leaderboard',
      icon: '🏆',
      category: 'Achievement',
      rarity: 'Epic',
      criteria: { type: 'points', value: 500, operator: '>=' },
      rewards: { points: 100 },
    },
    {
      name: 'Consistent Contributor',
      description: 'Posted for 7 days straight',
      icon: '🔥',
      category: 'Streak',
      rarity: 'Rare',
      criteria: { type: 'streak', value: 7, operator: '>=' },
      rewards: { points: 75 },
    },
    {
      name: 'Mentor',
      description: 'Helped other community members',
      icon: '🤝',
      category: 'Community',
      rarity: 'Epic',
      criteria: { type: 'custom', value: 5, operator: '>=' },
      rewards: { points: 100 },
    },
  ];

  await Badge.deleteMany({});
  const createdBadges = await Badge.create(badges);
  console.log(`✅ Created ${createdBadges.length} badges`);
  return createdBadges;
};

const seedRewards = async () => {
  console.log('🌱 Seeding rewards...');

  const rewards = [
    // Digital Rewards
    {
      name: 'Exclusive Phase 3 Course Access',
      description: 'Unlock advanced entrepreneurship content before other members',
      type: 'digital',
      category: 'Course Access',
      value: 'Early Access to Phase 3 Content',
      pointsCost: 500,
      levelRequired: 'Overcomer',
      digitalContent: {
        accessUrl: '/courses/phase-3-preview',
        instructions: 'Access will be granted to your account within 24 hours',
      },
      availability: { isActive: true, maxPerUser: 1 },
    },
    {
      name: 'Digital Certificate of Completion',
      description: 'Printable certificate for course completion',
      type: 'digital',
      category: 'Certificates',
      value: 'Personalized Certificate',
      pointsCost: 100,
      digitalContent: {
        downloadUrl: '/certificates/generate',
        instructions: 'Certificate will be generated with your name and completion date',
      },
      availability: { isActive: true, maxPerUser: 10 },
    },
    {
      name: 'Member Spotlight Feature',
      description: 'Be featured in the community spotlight for a week',
      type: 'digital',
      category: 'Spotlight',
      value: 'Weekly Community Spotlight',
      pointsCost: 200,
      availability: { isActive: true, maxPerUser: 2, stock: 12 },
    },

    // Tangible Rewards
    {
      name: 'YOU YES YOU Branded T-Shirt',
      description: 'High-quality cotton t-shirt with YOU YES YOU logo',
      type: 'tangible',
      category: 'Merchandise',
      value: 'Branded T-Shirt',
      pointsCost: 300,
      levelRequired: 'Builder',
      images: ['https://images.pexels.com/photos/1020585/pexels-photo-1020585.jpeg?auto=compress&cs=tinysrgb&w=400'],
      availability: { isActive: true, maxPerUser: 2, stock: 50 },
    },
    {
      name: 'Personal Development Journal',
      description: 'Custom journal for tracking goals and daily reflections',
      type: 'tangible',
      category: 'Merchandise',
      value: 'Goal Setting Journal',
      pointsCost: 250,
      images: ['https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg?auto=compress&cs=tinysrgb&w=400'],
      availability: { isActive: true, maxPerUser: 1, stock: 25 },
    },
    {
      name: '$25 Amazon Gift Card',
      description: 'Digital gift card for Amazon purchases',
      type: 'tangible',
      category: 'Gift Cards',
      value: '$25 Gift Card',
      pointsCost: 400,
      levelRequired: 'Overcomer',
      availability: { isActive: true, maxPerUser: 2, stock: 20 },
    },
    {
      name: 'Priority 1-on-1 Coaching Session',
      description: '60-minute personal coaching session with Marcus Johnson',
      type: 'experience',
      category: 'Coaching',
      value: '1-Hour Coaching Session',
      pointsCost: 800,
      levelRequired: 'Mentor-in-Training',
      availability: { isActive: true, maxPerUser: 1, stock: 5 },
    },
    {
      name: 'Book Giveaway: "Think and Grow Rich"',
      description: 'Physical copy of Napoleon Hill\'s classic success book',
      type: 'tangible',
      category: 'Books',
      value: 'Success Literature',
      pointsCost: 150,
      images: ['https://images.pexels.com/photos/1888015/pexels-photo-1888015.jpeg?auto=compress&cs=tinysrgb&w=400'],
      availability: { isActive: true, maxPerUser: 1, stock: 30 },
    },
  ];

  await Reward.deleteMany({});
  const createdRewards = await Reward.create(rewards);
  console.log(`✅ Created ${createdRewards.length} rewards`);
  return createdRewards;
};

const seedIntegrations = async () => {
  console.log('🌱 Seeding integrations...');

  const integrations = [
    {
      name: 'Zapier Automation',
      type: 'zapier',
      provider: 'Zapier',
      isActive: false, // Activated when configured
      configuration: {
        webhookUrl: process.env.ZAPIER_WEBHOOK_URL || '',
        apiKey: process.env.PLATFORM_API_KEY || '',
      },
      permissions: { read: true, write: false, webhook: true },
      events: [
        { trigger: 'new_member', action: 'add_to_crm', isActive: true },
        { trigger: 'course_completed', action: 'send_certificate', isActive: true },
        { trigger: 'event_attended', action: 'update_engagement', isActive: true },
      ],
    },
    {
      name: 'ConvertKit Email Marketing',
      type: 'email',
      provider: 'ConvertKit',
      isActive: false,
      configuration: {
        apiKey: process.env.CONVERTKIT_API_KEY || '',
      },
      permissions: { read: true, write: true, webhook: false },
    },
    {
      name: 'GoHighLevel CRM',
      type: 'crm',
      provider: 'GoHighLevel',
      isActive: false,
      configuration: {
        apiKey: process.env.GOHIGHLEVEL_API_KEY || '',
      },
      permissions: { read: true, write: true, webhook: false },
    },
  ];

  await Integration.deleteMany({});
  const createdIntegrations = await Integration.create(integrations);
  console.log(`✅ Created ${createdIntegrations.length} integrations`);
  return createdIntegrations;
};

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log('🗑️  Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Post.deleteMany({}),
      Course.deleteMany({}),
      Event.deleteMany({}),
      Resource.deleteMany({}),
      Connection.deleteMany({}),
      AdminSettings.deleteMany({}),
      Challenge.deleteMany({}),
      Badge.deleteMany({}),
      Reward.deleteMany({}),
      Integration.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    console.log('🌱 Starting database seeding...');

    const users = await seedUsers();
    const courses = await seedCourses();
    const posts = await seedPosts(users);
    const events = await seedEvents();
    const resources = await seedResources();
    const connections = await seedConnections(users);
    await seedAdminSettings();
    const challenges = await seedChallenges();
    const badges = await seedBadges();
    const rewards = await seedRewards();
    const integrations = await seedIntegrations();

    // Enroll some users in courses
    console.log('🌱 Adding course enrollments...');
    for (const user of users.slice(1)) { // Skip admin
      const randomCourses = courses.slice(0, Math.floor(Math.random() * courses.length) + 1);

      for (const course of randomCourses) {
        user.courses.push({
          courseId: course._id,
          enrolledAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          progress: Math.floor(Math.random() * 100),
          completedModules: [],
        });
      }

      await user.save();
    }

    // Add some event RSVPs
    console.log('🌱 Adding event RSVPs...');
    for (const event of events) {
      const attendeeCount = Math.floor(Math.random() * 10) + 5;
      const randomUsers = users.slice(0, attendeeCount);

      for (const user of randomUsers) {
        event.attendees.push({
          user: user._id,
          status: 'going',
        });
      }

      await event.save();
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('\n📊 Seeded data summary:');
    console.log(`   👥 Users: ${users.length}`);
    console.log(`   📚 Courses: ${courses.length}`);
    console.log(`   📝 Posts: ${posts.length}`);
    console.log(`   📅 Events: ${events.length}`);
    console.log(`   📋 Resources: ${resources.length}`);
    console.log(`   🤝 Connections: ${connections.length}`);
    console.log(`   🏆 Challenges: ${challenges.length}`);
    console.log(`   🏅 Badges: ${badges.length}`);
    console.log(`   🎁 Rewards: ${rewards.length}`);
    console.log(`   🔌 Integrations: ${integrations.length}`);
    console.log('\n🔐 Admin credentials:');
    console.log('   Email: admin@youyesyou.com');
    console.log('   Password: Admin123!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}

export default seedDatabase;