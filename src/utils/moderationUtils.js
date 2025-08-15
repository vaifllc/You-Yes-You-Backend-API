// Comprehensive content moderation utilities
import fs from 'fs';

const PROFANITY_WORDS = [
  // General profanity
  'damn', 'hell', 'crap', 'stupid', 'idiot', 'dumb', 'moron', 'loser',
  'bitch', 'bastard', 'asshole', 'shit', 'fuck', 'motherfucker', 'fucking',
  'bullshit', 'douche', 'dipshit', 'jackass', 'prick', 'dick', 'dickhead',
  'pussy', 'cunt', 'twat', 'wanker', 'slut', 'whore', 'bloody', 'wtf', 'pos',
  // Drug-related/inappropriate
  'meth', 'crack', 'cocaine', 'heroin', 'weed', 'dealer',
];

// Common obfuscated profanity patterns (e.g., f*ck, f@ck, sh!t)
const PROFANITY_PATTERNS = [
  /\bf+[@*#]?[u*]?[c*]k+\b/i,            // fuck variations
  /\bf+[@*#]?[u*]?[c*]king\b/i,         // fucking
  /\bsh[*#!]?[i1]t+\b/i,                // shit variations
  /\b[a@]ss[h*#]?o?l[e3]\b/i,           // asshole variations
  /\bb[i1!]tch(e?s|y)?\b/i,              // bitch, bitches, bitchy
  /\bd[i1!]ck(head)?\b/i,                // dick, dickhead
  /\bc[*#]unt+\b/i,                      // cunt
  /\bp[u*]ss[y1]+\b/i,                   // pussy
  /\bwh[o0]re+\b/i,                      // whore
  /\bd[o0]uche\b/i,                       // douche
  /\bbull[*#]?shit\b/i,                  // bullshit
  /\bwtf\b/i,                             // wtf
];

// Hate speech patterns and common slurs (kept generic; do not log raw content)
const HATE_SPEECH_PATTERNS = [
  // More specific patterns to avoid false positives
  /\b(hate|kill|murder)\s+(you|them|him|her|yourself)\b/gi,
  /\b(go\s+die|kill\s+yourself)\b/gi,
  /\b(worthless|pathetic|scum|trash)\s+(person|human|father|man|people)\b/gi,
  /\b(should\s+be\s+dead|deserve\s+to\s+die)\b/gi,
  // slurs (obfuscated variants)
  /\bn+[@a4]*g+[@a4]*g+[e3]*r*\b/i,
  /\bk+[@a4]*k+[@a4]*\b/i,
  /\bc+h+i+n+k+\b/i,
  /\bs+p+i*c+\b/i,
  /\bt+r+[@a4]n+n*y+\b/i,
  /\bf+[@a4]g+(g*o*t+)?\b/i,
];

// Bullying/harassment patterns (non-protected-class insults, direct attacks)
const BULLYING_PATTERNS = [
  /\b(you('re| are)\s+)?(idiot|stupid|moron|loser|worthless|pathetic|ugly|fat|retard)\b/gi,
  /\b(nobody\s+likes\s+you|you\s+should\s+quit|go\s+away)\b/gi,
  /\b(kill\s+yourself|end\s+your\s+life)\b/gi,
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

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;

const normalizeContent = (content) => {
  if (typeof content !== 'string') return '';
  const mappings = {
    '@': 'a', '4': 'a',
    '$': 's', '5': 's',
    '0': 'o',
    '1': 'i', '!': 'i', '|': 'i',
    '3': 'e',
    '7': 't',
  };
  const base = content
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(ZERO_WIDTH, '')
    .toLowerCase();
  return base.replace(/[@$!|013457]/g, (ch) => mappings[ch] || ch);
};

const compact = (str) => str.replace(/[^a-z0-9]+/gi, '');
const collapseRepeats = (str) => str.replace(/(.)\1{2,}/g, '$1$1');
const deVowel = (str) => str.replace(/[aeiou]/g, '');

const buildLoosePattern = (term) => {
  const safe = term.replace(/[^a-z0-9]/gi, '');
  const chars = safe.split('');
  const between = '[^a-z0-9]{0,3}';
  return new RegExp(chars.map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(between), 'i');
};

let EXTERNAL_BANNED = [];
try {
  if (process.env.BANNED_TERMS_PATH && fs.existsSync(process.env.BANNED_TERMS_PATH)) {
    const raw = fs.readFileSync(process.env.BANNED_TERMS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      EXTERNAL_BANNED = parsed.filter(x => typeof x === 'string');
    }
  }
} catch {}

const BANNED_TERMS = Array.from(new Set([
  // Core profanity (extendable via BANNED_TERMS_PATH)
  ...PROFANITY_WORDS,
  // Generic hate/harassment umbrella terms (specific slurs covered by patterns below)
  'go die', 'kill yourself', 'worthless', 'pathetic', 'scum', 'trash',
  ...EXTERNAL_BANNED,
]));

const BANNED_LOOSE_PATTERNS = BANNED_TERMS.map(buildLoosePattern);

export const moderateContent = (content) => {
  const issues = [];
  const flags = {
    profanity: false,
    hateSpeech: false,
    bullying: false,
    spam: false,
    inappropriate: false,
    personalInfo: false,
    severity: 0,
  };

  const normalized = normalizeContent(content || '');
  const normalizedCompact = compact(normalized);
  const normalizedCollapsed = collapseRepeats(normalizedCompact);
  const normalizedDevowel = deVowel(normalizedCollapsed);

  // Check for profanity (words and obfuscated patterns)
  const profanityFound =
    PROFANITY_PATTERNS.some((pattern) => pattern.test(content) || pattern.test(normalized)) ||
    PROFANITY_WORDS.some(word =>
      normalized.includes(word.toLowerCase()) ||
      normalizedCollapsed.includes(compact(word).toLowerCase()) ||
      normalizedDevowel.includes(deVowel(word.toLowerCase()))
    ) ||
    BANNED_LOOSE_PATTERNS.some((rx) => rx.test(content) || rx.test(normalized))
  ;

  if (profanityFound) {
    flags.profanity = true;
    flags.severity += 2;
    issues.push('Contains profanity');
  }

  // Check for hate speech - ensure we're not getting false positives
  const hateSpeechFound = HATE_SPEECH_PATTERNS.some(pattern => {
    // Skip checking single words or very short phrases that might trigger false positives
    if (content.length < 5) return false;
    return pattern.test(content) || pattern.test(normalized) || pattern.test(normalizedCollapsed);
  });

  if (hateSpeechFound) {
    flags.hateSpeech = true;
    flags.severity += 5;
    issues.push('Contains hate speech');
  }

  // Check for bullying/harassment
  const bullyingFound = BULLYING_PATTERNS.some(pattern => pattern.test(content) || pattern.test(normalized) || pattern.test(normalizedCollapsed));
  if (bullyingFound) {
    flags.bullying = true;
    flags.severity += 4;
    issues.push('Contains bullying or harassment');
  }

  // Check for spam
  const spamFound = SPAM_INDICATORS.some(pattern =>
    pattern.test(content) || pattern.test(normalized) || pattern.test(normalizedCollapsed)
  );

  if (spamFound) {
    flags.spam = true;
    flags.severity += 3;
    issues.push('Appears to be spam');
  }

  // Check for inappropriate content
  const inappropriateFound = INAPPROPRIATE_CONTENT.some(pattern =>
    pattern.test(content) || pattern.test(normalized) || pattern.test(normalizedCollapsed)
  );

  if (inappropriateFound) {
    flags.inappropriate = true;
    flags.severity += 4;
    issues.push('Contains inappropriate content');
  }

  // Check for personal information sharing
  const personalInfoFound = PERSONAL_INFO_PATTERNS.some(pattern =>
    pattern.test(content) || pattern.test(normalized)
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
    // Strict blocking for profanity, hate speech, bullying, nudity/sexual content
    shouldBlock: flags.profanity || flags.hateSpeech || flags.bullying || flags.inappropriate,
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