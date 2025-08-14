import AdminSettings from '../models/AdminSettings.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// @desc    Get all settings
// @route   GET /api/admin/settings
// @access  Private (Admin)
export const getAllSettings = asyncHandler(async (req, res) => {
  const settings = await AdminSettings.find()
    .populate('updatedBy', 'name username')
    .sort({ category: 1 });

  // Organize settings by category
  const organizedSettings = {};
  settings.forEach(setting => {
    organizedSettings[setting.category] = {
      ...setting.settings,
      lastUpdated: setting.updatedAt,
      updatedBy: setting.updatedBy,
    };
  });

  res.status(200).json({
    success: true,
    data: organizedSettings,
  });
});

// @desc    Get settings by category
// @route   GET /api/admin/settings/:category
// @access  Private (Admin)
export const getSettingsByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;

  const settings = await AdminSettings.getByCategory(category);

  if (!settings) {
    // Return default settings for the category
    const defaultSettings = getDefaultSettings(category);
    return res.status(200).json({
      success: true,
      data: defaultSettings,
    });
  }

  res.status(200).json({
    success: true,
    data: settings.settings,
  });
});

// @desc    Update settings by category
// @route   PUT /api/admin/settings/:category
// @access  Private (Admin)
export const updateSettingsByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const settings = req.body;

  const updatedSettings = await AdminSettings.updateSettings(
    category,
    settings,
    req.user._id
  );

  res.status(200).json({
    success: true,
    message: 'Settings updated successfully',
    data: updatedSettings.settings,
  });
});

// Default settings for each category
const getDefaultSettings = (category) => {
  const defaults = {
    general: {
      communityName: 'YOU YES YOU',
      communityDescription: 'YOU YES YOU community is a private community for formerly incarcerated fathers committed to personal growth, family restoration, and financial empowerment.',
      welcomeMessage: 'Welcome to YOU YES YOU! We\'re excited to have you join our brotherhood of transformation.',
      coverImage: '',
      primaryColor: '#2563eb',
      secondaryColor: '#16a34a',
      timezone: 'America/New_York',
      language: 'en',
    },
    invite: {
      requireApproval: true,
      sendWelcomeMessage: true,
      invitationExpiry: 30,
      maxUses: 50,
      customMessage: 'You\'ve been invited to join the YOU YES YOU community. We believe you would be a valuable addition to our brotherhood.',
    },
    domain: {
      customDomain: '',
      subdomain: 'platform',
      forceHttps: true,
      redirectWww: true,
    },
    categories: {
      categories: [
        { name: 'General Discussion', permissions: 'All Members', visibility: 'Public' },
        { name: 'Announcements', permissions: 'Admin Only', visibility: 'Public' },
        { name: 'Wins & Victories', permissions: 'All Members', visibility: 'Public' },
        { name: 'Questions & Support', permissions: 'All Members', visibility: 'Public' },
        { name: 'Feedback', permissions: 'All Members', visibility: 'Public' },
        { name: 'Phase 3 Entrepreneurs', permissions: 'Phase 3 Only', visibility: 'Private' },
      ],
      rules: [
        'Be positive and supportive in all interactions',
        'No self-promotion or spam content',
        'Make an effort to contribute meaningful content',
        'Respect confidentiality and privacy of all members',
        'Stay on topic within each category',
      ],
    },
    tabs: {
      tabs: [
        { name: 'Community', path: '/community', visible: true, permissions: 'All Members' },
        { name: 'Classroom', path: '/classroom', visible: true, permissions: 'All Members' },
        { name: 'Calendar', path: '/calendar', visible: true, permissions: 'All Members' },
        { name: 'Members', path: '/members', visible: true, permissions: 'All Members' },
        { name: 'Leaderboard', path: '/leaderboard', visible: true, permissions: 'All Members' },
        { name: 'About', path: '/about', visible: true, permissions: 'All Members' },
        { name: 'Resources', path: '/resources', visible: false, permissions: 'Phase 2+' },
        { name: 'Mentorship', path: '/mentorship', visible: false, permissions: 'Phase 3 Only' },
      ],
      mobileSettings: {
        showLabels: true,
        collapsible: true,
        maxTabs: 5,
      },
    },
    gamification: {
      pointSystem: {
        createPost: 10,
        commentPost: 5,
        completeCourse: 50,
        attendEvent: 25,
        dailyLogin: 2,
        completeProfile: 15,
      },
      levels: [
        { name: 'New Member', points: 0 },
        { name: 'Committed Member', points: 100 },
        { name: 'Rising Leader', points: 500 },
        { name: 'Community Champion', points: 1000 },
        { name: 'Mentor', points: 2000 },
      ],
      leaderboardSettings: {
        weeklyReset: true,
        showAllTime: true,
        displayCount: 25,
        enableRewards: true,
      },
    },
    appearance: {
      colorScheme: {
        primary: '#2563eb',
        secondary: '#16a34a',
        accent: '#dc2626',
        background: '#ffffff',
      },
      typography: {
        fontFamily: 'Inter',
        fontSize: 'Medium',
      },
      layout: {
        borderRadius: 8,
        compactLayout: false,
        showAnimations: true,
      },
      mobile: {
        responsiveNavigation: true,
        touchFriendly: true,
      },
      accessibility: {
        highContrast: false,
        largeText: false,
        keyboardNavigation: true,
      },
    },
    discovery: {
      privacy: {
        isPublic: false,
        searchIndexing: false,
        requireApproval: true,
        showMemberCount: false,
        allowGuestViewing: false,
      },
      seo: {
        metaTitle: 'YOU YES YOU - Community Platform for Formerly Incarcerated Fathers',
        metaDescription: 'A private community for formerly incarcerated fathers focused on personal development, family restoration, and financial empowerment.',
        keywords: 'reentry, fatherhood, personal development, financial literacy, community support',
        openGraphImage: '',
      },
      social: {
        enableSharing: false,
        facebookPage: '',
        twitterHandle: '',
        linkedinPage: '',
      },
    },
    links: {
      externalLinks: [
        {
          title: 'YOU YES YOU Main Website',
          url: 'https://youyesyou.org',
          description: 'Official website and mission information',
          visible: true,
          newTab: true,
        },
        {
          title: 'Donation Page',
          url: 'https://donate.youyesyou.org',
          description: 'Support the YOU YES YOU Project',
          visible: true,
          newTab: true,
        },
        {
          title: 'Application Form',
          url: 'https://apply.youyesyou.org',
          description: 'Apply to join the community',
          visible: true,
          newTab: true,
        },
      ],
      displaySettings: {
        location: 'Below Community Description',
        showIcons: true,
        showDescriptions: true,
        maxDisplay: 5,
      },
    },
    moderation: {
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
      reportSettings: {
        allowAnonymous: false,
        requireReason: true,
        autoEscalate: true,
      },
    },
    about: {
      hero: {
        title: 'Welcome to the YOU YES YOU Project',
        subtitle: 'A transformative digital community for formerly incarcerated fathers ready to rebuild, restore, and rise into financial, spiritual, and emotional freedom.'
      },
      mission: {
        heading: 'A Brotherhood. A Blueprint. A Second Chance That Leads to Your Best Life.',
        paragraphs: [
          'Welcome to the YOU YES YOU Community—a digital sanctuary built specifically for formerly incarcerated fathers who are ready to rebuild their lives, reclaim their families, and rise into purpose-driven leaders.',
          'This isn\'t just another reentry program. This is a movement of men walking in truth, healing through accountability, and building legacies through knowledge, action, and community.'
        ]
      },
      phases: [
        {
          number: 1,
          title: 'Personal Development',
          description: 'Build the foundation of your transformation through mindset work, goal setting, and personal accountability.',
          duration: '8-12 weeks',
          focus: ['Self-awareness', 'Goal Setting', 'Mindset Transformation', 'Accountability']
        },
        {
          number: 2,
          title: 'Financial Literacy',
          description: 'Master the fundamentals of money management, credit repair, and building wealth from the ground up.',
          duration: '10-14 weeks',
          focus: ['Budgeting & Saving', 'Credit Repair', 'Investment Basics', 'Financial Planning']
        },
        {
          number: 3,
          title: 'Entrepreneurship',
          description: 'Turn your skills and passion into a sustainable business. Learn the essentials of starting and growing your own company.',
          duration: '12-16 weeks',
          focus: ['Business Planning', 'Marketing & Sales', 'Operations', 'Leadership']
        }
      ],
      guidelines: [
        { title: 'Respect & Brotherhood', description: 'Treat every member with dignity and respect. We are all on this journey together.' },
        { title: 'Confidentiality', description: 'What is shared in the community stays in the community. Protect each other\'s privacy.' },
        { title: 'Constructive Engagement', description: 'Share knowledge, ask questions, and provide meaningful support to fellow members.' },
        { title: 'Commitment to Growth', description: 'Show up consistently, complete your coursework, and actively participate in the community.' }
      ],
      cta: {
        heading: 'Ready to Begin Your Transformation?',
        steps: [
          'Complete Onboarding',
          'Join Community Discussions',
          'Start Phase 1 Coursework'
        ]
      },
      footer: {
        quote: 'Your past doesn\'t define your future. Your choices do. Let\'s make them count.',
        author: '— Michael A. Copeland, Chief Administrator'
      }
    },
  };

  return defaults[category] || {};
};