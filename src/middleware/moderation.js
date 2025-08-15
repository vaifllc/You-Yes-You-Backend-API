import { moderateContent } from '../utils/moderationUtils.js';
import { isImageExplicit } from '../services/imageModeration.js';

// Middleware to moderate content before it's saved
export const moderateContentMiddleware = (contentField = 'content') => {
  return (req, res, next) => {
    const content = req.body[contentField];

    if (!content) {
      return next(); // No content to moderate
    }

    const moderation = moderateContent(content);

    // Block content that should be blocked
    if (moderation.shouldBlock) {
      return res.status(400).json({
        success: false,
        message: 'Content violates community guidelines and cannot be posted',
        issues: moderation.issues,
        severity: moderation.severity,
      });
    }

    // Flag content for review but allow it through with cleaned version
    if (moderation.shouldFlag) {
      req.body[contentField] = moderation.cleanedContent;
      req.contentModeration = {
        flagged: true,
        issues: moderation.issues,
        severity: moderation.severity,
        originalContent: content,
      };
    } else {
      req.contentModeration = {
        flagged: false,
        clean: true,
      };
    }

    next();
  };
};

// Middleware for posts (also checks images if present)
export const moderatePostContent = async (req, res, next) => {
  const { content, images } = req.body;

  if (!content) {
    return res.status(400).json({
      success: false,
      message: 'Post content is required',
    });
  }

  const moderation = moderateContent(content);

  // Block inappropriate content
  if (moderation.shouldBlock) {
    console.warn('🚫 Post blocked by moderation', {
      user: req.user?.username,
      path: req.originalUrl,
      issues: moderation.issues,
      severity: moderation.severity,
    });
    return res.status(400).json({
      success: false,
      message: 'Post violates community guidelines and cannot be published',
      issues: moderation.issues,
      details: 'Please review our community guidelines and modify your content.',
    });
  }

  // Check for image moderation (basic checks + provider scan if configured)
  if (images && images.length > 0) {
    if (images.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 images allowed per post',
      });
    }

    // Disallow nudity/explicit content via filename/URL heuristics
    const nudityPattern = /(nude|naked|porn|xxx|nsfw|explicit|sex|erotic)/i;
    const hasNudity = images.some((img) =>
      typeof img === 'string' ? nudityPattern.test(img) : false
    );
    if (hasNudity) {
      console.warn('🚫 Post images blocked for nudity keywords', {
        user: req.user?.username,
        path: req.originalUrl,
      });
      return res.status(400).json({
        success: false,
        message: 'Post images violate community guidelines (nudity is not allowed)',
      });
    }

    // Provider-based scanning for image URLs
    const urlImages = images.filter((img) => typeof img === 'string' && /^https?:\/\//i.test(img));
    if (urlImages.length > 0) {
      try {
        const results = await Promise.all(urlImages.map((url) => isImageExplicit(url)));
        const flagged = results.find((r) => r.isExplicit);
        if (flagged) {
          console.warn('🚫 Post images blocked by vision moderation', {
            user: req.user?.username,
            path: req.originalUrl,
            reason: flagged.reasons,
            score: flagged.score,
          });
          return res.status(400).json({
            success: false,
            message: 'Post images violate community guidelines (vision moderation)',
          });
        }
      } catch (e) {
        // Fail-open on provider errors; filename heuristic still applied
      }
    }
  }

  // Apply content filtering
  if (moderation.shouldFlag) {
    req.body.content = moderation.cleanedContent;
    req.contentModeration = {
      flagged: true,
      requiresApproval: true,
      issues: moderation.issues,
      severity: moderation.severity,
      originalContent: content,
    };
  } else {
    req.contentModeration = {
      flagged: false,
      clean: true,
      requiresApproval: false,
    };
  }

  next();
};

// Middleware for comments
export const moderateCommentContent = async (req, res, next) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({
      success: false,
      message: 'Comment content is required',
    });
  }

  const moderation = moderateContent(content);

  // Block inappropriate comments immediately
  if (moderation.shouldBlock) {
    console.warn('🚫 Comment blocked by moderation', {
      user: req.user?.username,
      path: req.originalUrl,
      issues: moderation.issues,
      severity: moderation.severity,
    });
    return res.status(400).json({
      success: false,
      message: 'Comment violates community guidelines',
      issues: moderation.issues,
    });
  }

  // Apply filtering
  if (moderation.shouldFlag) {
    req.body.content = moderation.cleanedContent;
    req.contentModeration = {
      flagged: true,
      issues: moderation.issues,
      severity: moderation.severity,
    };
  } else {
    req.contentModeration = {
      flagged: false,
      clean: true,
    };
  }

  next();
};

// Middleware for messages
export const moderateMessageContent = async (req, res, next) => {
  const { content, type = 'text' } = req.body;

  // If image/file message, apply a basic nudity filename/URL heuristic if content is provided
  if (type !== 'text') {
    if (typeof content === 'string' && content.length > 0) {
      const nudityPattern = /(nude|naked|porn|xxx|nsfw|explicit|sex|erotic)/i;
      if (nudityPattern.test(content)) {
        console.warn('🚫 Message blocked for nudity keywords', {
          user: req.user?.username,
          path: req.originalUrl,
        });
        return res.status(400).json({
          success: false,
          message: 'Message violates community guidelines (nudity is not allowed)',
        });
      }
    }
    // If message contains a URL to an image, scan with provider
    if (typeof content === 'string') {
      const urlMatch = content.match(/https?:\/\/[\S]+/gi) || [];
      const imageUrls = urlMatch.filter((u) => /(\.png|\.jpe?g|\.gif|\.webp)(\?|$)/i.test(u));
      if (imageUrls.length > 0) {
        try {
          const results = await Promise.all(imageUrls.map((url) => isImageExplicit(url)));
          const flagged = results.find((r) => r.isExplicit);
          if (flagged) {
            console.warn('🚫 Message blocked by vision moderation', {
              user: req.user?.username,
              path: req.originalUrl,
              reason: flagged.reasons,
              score: flagged.score,
            });
            return res.status(400).json({
              success: false,
              message: 'Message violates community guidelines (vision moderation)',
            });
          }
        } catch {}
      }
    }
    return next();
  }

  const moderation = moderateContent(content);

  // Block inappropriate messages
  if (moderation.shouldBlock) {
    console.warn('🚫 Message blocked by moderation', {
      user: req.user?.username,
      path: req.originalUrl,
      issues: moderation.issues,
      severity: moderation.severity,
    });
    return res.status(400).json({
      success: false,
      message: 'Message violates community guidelines',
      issues: moderation.issues,
    });
  }

  // Apply filtering for flagged content
  if (moderation.shouldFlag) {
    req.body.content = moderation.cleanedContent;
    req.contentModeration = {
      flagged: true,
      issues: moderation.issues,
      severity: moderation.severity,
    };
  } else {
    req.contentModeration = {
      flagged: false,
      clean: true,
    };
  }

  next();
};

// Middleware to check if user is banned or suspended
export const checkUserStatus = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return next(); // Let auth middleware handle this
    }

    // Check for active ban
    const activeBan = user.warnings?.find(warning =>
      warning.type === 'banned' && warning.isActive
    );

    if (activeBan) {
      return res.status(403).json({
        success: false,
        message: 'Account is banned from posting content',
        reason: activeBan.reason,
        bannedAt: activeBan.issuedAt,
      });
    }

    // Check for active suspension
    const activeSuspension = user.warnings?.find(warning =>
      warning.type === 'suspension' &&
      warning.isActive &&
      warning.expiresAt > new Date()
    );

    if (activeSuspension) {
      return res.status(403).json({
        success: false,
        message: 'Account is temporarily suspended from posting',
        reason: activeSuspension.reason,
        expiresAt: activeSuspension.expiresAt,
      });
    }

    // User is in good standing
    next();
  } catch (error) {
    console.error('Error checking user status:', error);
    next();
  }
};

// Middleware to log moderation actions
export const logModerationAction = (action) => {
  return (req, res, next) => {
    // Store original json method
    const originalJson = res.json;

    // Override json method to log after response
    res.json = function(data) {
      // Log moderation action if content was flagged
      if (req.contentModeration?.flagged) {
        console.log(`🚨 Content flagged: ${action}`, {
          user: req.user.username,
          issues: req.contentModeration.issues,
          severity: req.contentModeration.severity,
          timestamp: new Date().toISOString(),
        });
      }

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
};

export default {
  moderateContentMiddleware,
  moderatePostContent,
  moderateCommentContent,
  moderateMessageContent,
  checkUserStatus,
  logModerationAction,
};