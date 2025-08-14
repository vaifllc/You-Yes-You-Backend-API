import AdminSettings from '../models/AdminSettings.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// Local default about configuration (mirrors admin defaults)
const defaultAbout = {
  hero: {
    title: 'Welcome to the YOU YES YOU Project',
    subtitle:
      'A transformative digital community for formerly incarcerated fathers ready to rebuild, restore, and rise into financial, spiritual, and emotional freedom.',
  },
  mission: {
    heading: 'A Brotherhood. A Blueprint. A Second Chance That Leads to Your Best Life.',
    paragraphs: [
      'Welcome to the YOU YES YOU Community—a digital sanctuary built specifically for formerly incarcerated fathers who are ready to rebuild their lives, reclaim their families, and rise into purpose-driven leaders.',
      "This isn't just another reentry program. This is a movement of men walking in truth, healing through accountability, and building legacies through knowledge, action, and community.",
    ],
  },
  phases: [
    {
      number: 1,
      title: 'Personal Development',
      description:
        'Build the foundation of your transformation through mindset work, goal setting, and personal accountability.',
      duration: '8-12 weeks',
      focus: ['Self-awareness', 'Goal Setting', 'Mindset Transformation', 'Accountability'],
    },
    {
      number: 2,
      title: 'Financial Literacy',
      description:
        'Master the fundamentals of money management, credit repair, and building wealth from the ground up.',
      duration: '10-14 weeks',
      focus: ['Budgeting & Saving', 'Credit Repair', 'Investment Basics', 'Financial Planning'],
    },
    {
      number: 3,
      title: 'Entrepreneurship',
      description:
        'Turn your skills and passion into a sustainable business. Learn the essentials of starting and growing your own company.',
      duration: '12-16 weeks',
      focus: ['Business Planning', 'Marketing & Sales', 'Operations', 'Leadership'],
    },
  ],
  guidelines: [
    { title: 'Respect & Brotherhood', description: 'Treat every member with dignity and respect. We are all on this journey together.' },
    { title: 'Confidentiality', description: "What is shared in the community stays in the community. Protect each other's privacy." },
    { title: 'Constructive Engagement', description: 'Share knowledge, ask questions, and provide meaningful support to fellow members.' },
    { title: 'Commitment to Growth', description: 'Show up consistently, complete your coursework, and actively participate in the community.' },
  ],
  cta: {
    heading: 'Ready to Begin Your Transformation?',
    steps: ['Complete Onboarding', 'Join Community Discussions', 'Start Phase 1 Coursework'],
  },
  footer: {
    quote: "Your past doesn't define your future. Your choices do. Let's make them count.",
    author: '— Michael A. Copeland, Chief Administrator',
  },
};

export const getAboutContent = asyncHandler(async (req, res) => {
  const settings = await AdminSettings.getByCategory('about');

  res.status(200).json({
    success: true,
    data: settings?.settings || defaultAbout,
  });
});

export default {
  getAboutContent,
};


