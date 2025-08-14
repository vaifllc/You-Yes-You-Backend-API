// Comprehensive content moderation utilities

const PROFANITY_WORDS = [
  // Basic profanity words - expand this list as needed
  'damn', 'hell', 'crap', 'stupid', 'idiot', 'dumb', 'moron', 'loser',
  'bitch', 'bastard', 'asshole', 'shit', 'fuck', 'motherfucker',
  // Racial slurs and hate speech - add comprehensive list
  // Drug-related terms inappropriate for community
  'meth', 'crack', 'cocaine', 'heroin', 'weed', 'dealer',
];

const HATE_SPEECH_PATTERNS = [
  /\b(hate|kill|die|murder|destroy)\s+(you|them|him|her|yourself)\b/gi,
  /\b(go\s+die|kill\s+yourself)\b/gi,
  /\b(worthless|pathetic|scum|trash)\s+(person|human|father|man)\b/gi,
  /\b(should\s+be\s+dead|deserve\s+to\s+die)\b/gi,
  /\b(racial|ethnic)\s+slur\s+patterns\b/gi, // Add actual patterns carefully
];

const SPAM_INDICATORS = [
  /\b(click\s+here|free\s+money|make\s+\$\d+|guaranteed\s+income)\b/gi,
  /\b(viagra|casino|lottery|winner|crypto|bitcoin|investment)\b/gi,
  /(https?:\/\/[^\s]+){3,}/gi, // Multiple links
  /\b(buy\s+now|limited\s+time|act\s+fast|call\s+now)\b/gi,
  /(.)\1{10,}/g, // Excessive repeated characters
];

const INAPPROPRIATE_CONTENT = [
  /\b(nude|naked|sex|porn|xxx|sexual|explicit)\b/gi,
  /\b(drug\s+deal|buy\s+weed|sell\s+drugs|selling\s+pills)\b/gi,
  /\b(illegal\s+activity|breaking\s+law|commit\s+crime)\b/gi,
  /\b(self\s+harm|suicide|cutting|overdose)\b/gi,
];

// Personal information patterns to protect privacy
const PERSONAL_INFO_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern
  /\b\d{3}-\d{3}-\d{4}\b/g, // Phone number pattern
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email pattern
  /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, // Credit card pattern
];

export const moderateContent = (content) => {
  const issues = [];
  const flags = {
    profanity: false,
    hateSpeech: false,
    spam: false,
    inappropriate: false,
    personalInfo: false,
    severity: 0,
  };

  // Check for profanity
  const profanityFound = PROFANITY_WORDS.some(word => 
    content.toLowerCase().includes(word.toLowerCase())
  );
  
  if (profanityFound) {
    flags.profanity = true;
    flags.severity += 2;
    issues.push('Contains profanity');
  }

  // Check for hate speech
  const hateSpeechFound = HATE_SPEECH_PATTERNS.some(pattern => 
    pattern.test(content)
  );
  
  if (hateSpeechFound) {
    flags.hateSpeech = true;
    flags.severity += 5;
    issues.push('Contains hate speech');
  }

  // Check for spam
  const spamFound = SPAM_INDICATORS.some(pattern => 
    pattern.test(content)
  );
  
  if (spamFound) {
    flags.spam = true;
    flags.severity += 3;
    issues.push('Appears to be spam');
  }

  // Check for inappropriate content
  const inappropriateFound = INAPPROPRIATE_CONTENT.some(pattern => 
    pattern.test(content)
  );
  
  if (inappropriateFound) {
    flags.inappropriate = true;
    flags.severity += 4;
    issues.push('Contains inappropriate content');
  }

  // Check for personal information sharing
  const personalInfoFound = PERSONAL_INFO_PATTERNS.some(pattern => 
    pattern.test(content)
  );
  
  if (personalInfoFound) {
    flags.personalInfo = true;
    flags.severity += 3;
    issues.push('Contains personal information that should be kept private');
  }

  // Additional checks
  const allCaps = content.length > 10 && content === content.toUpperCase();
  if (allCaps) {
    flags.severity += 1;
    issues.push('Excessive use of capital letters');
  }

  // Check for repeated characters (like "hellooooooo")
  const repeatedChars = /(.)\1{5,}/g.test(content);
  if (repeatedChars) {
    flags.severity += 1;
    issues.push('Excessive repeated characters');
  }

  return {
    isClean: flags.severity === 0,
    shouldBlock: flags.severity >= 5,
    shouldFlag: flags.severity >= 3,
    flags,
    issues,
    severity: flags.severity,
    cleanedContent: filterProfanity(content),
  };
};

export const filterProfanity = (content) => {
  let filtered = content;
  
  PROFANITY_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });
  
  // Filter personal information
  PERSONAL_INFO_PATTERNS.forEach(pattern => {
    filtered = filtered.replace(pattern, '[PERSONAL INFO REMOVED]');
  });
  
  return filtered;
};

export const analyzeUserBehavior = async (userId, User, Post, Report) => {
  const user = await User.findById(userId);
  if (!user) return null;

  // Get user's recent activity
  const recentPosts = await Post.find({ 
    author: userId, 
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
  });

  // Get reports against this user
  const reports = await Report.find({ 
    reportedUser: userId,
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  });

  const riskScore = calculateRiskScore(user, recentPosts, reports);

  return {
    userId,
    riskScore,
    recentPostCount: recentPosts.length,
    reportCount: reports.length,
    warnings: user.warnings?.length || 0,
    recommendations: generateRecommendations(riskScore, reports),
  };
};

const calculateRiskScore = (user, recentPosts, reports) => {
  let score = 0;

  // Account age factor (newer accounts are riskier)
  const accountAge = Date.now() - user.createdAt.getTime();
  const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
  if (daysSinceCreation < 7) score += 2;
  else if (daysSinceCreation < 30) score += 1;

  // Post frequency (too many posts in short time)
  if (recentPosts.length > 20) score += 3;
  else if (recentPosts.length > 10) score += 1;

  // Report history
  score += reports.length * 2;

  // Warning history
  score += (user.warnings?.length || 0) * 3;

  // Low engagement score (no likes, comments)
  const hasLowEngagement = recentPosts.every(post => 
    (post.likes?.length || 0) === 0 && (post.comments?.length || 0) === 0
  );
  if (hasLowEngagement && recentPosts.length > 5) score += 2;

  return Math.min(score, 10); // Cap at 10
};

const generateRecommendations = (riskScore, reports) => {
  const recommendations = [];

  if (riskScore >= 7) {
    recommendations.push('Consider temporary suspension');
    recommendations.push('Require manual approval for future posts');
  } else if (riskScore >= 5) {
    recommendations.push('Increase monitoring frequency');
    recommendations.push('Consider issuing a warning');
  } else if (riskScore >= 3) {
    recommendations.push('Monitor closely for 48 hours');
  }

  const recentReports = reports.filter(report => 
    Date.now() - report.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000
  );

  if (recentReports.length >= 3) {
    recommendations.push('Multiple recent reports - investigate immediately');
  }

  return recommendations;
};

export const getModerationStats = async (Post, Report, User) => {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    pendingReports,
    reportsThisWeek,
    reportsThisMonth,
    flaggedPosts,
    bannedUsers,
  ] = await Promise.all([
    Report.countDocuments({ status: 'pending' }),
    Report.countDocuments({ createdAt: { $gte: weekAgo } }),
    Report.countDocuments({ createdAt: { $gte: monthAgo } }),
    Post.countDocuments({ isApproved: false }),
    User.countDocuments({ 'warnings.type': 'banned' }),
  ]);

  return {
    pendingReports,
    reportsThisWeek,
    reportsThisMonth,
    flaggedPosts,
    bannedUsers,
    moderationLoad: pendingReports + flaggedPosts,
  };
};

export default {
  moderateContent,
  filterProfanity,
  analyzeUserBehavior,
  getModerationStats,
};