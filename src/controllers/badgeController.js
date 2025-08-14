import Badge from '../models/Badge.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// @desc    Get all badges
// @route   GET /api/badges
// @access  Private
export const getBadges = asyncHandler(async (req, res) => {
  const { category, rarity } = req.query;

  const query = { isActive: true };
  
  if (category && category !== 'all') {
    query.category = category;
  }
  
  if (rarity && rarity !== 'all') {
    query.rarity = rarity;
  }

  const badges = await Badge.find(query)
    .sort({ order: 1, category: 1 })
    .lean();

  // Add user earned status
  if (req.user) {
    badges.forEach(badge => {
      badge.earnedByUser = badge.earnedBy?.some(
        earned => earned.user.toString() === req.user._id.toString()
      ) || false;
      
      if (badge.earnedByUser) {
        const userEarned = badge.earnedBy.find(
          earned => earned.user.toString() === req.user._id.toString()
        );
        badge.earnedAt = userEarned.earnedAt;
      }
    });
  }

  res.status(200).json({
    success: true,
    data: badges,
  });
});

// @desc    Get user's badges
// @route   GET /api/badges/my-badges
// @access  Private
export const getUserBadges = asyncHandler(async (req, res) => {
  const badges = await Badge.find({
    'earnedBy.user': req.user._id,
  }).sort({ 'earnedBy.earnedAt': -1 });

  // Add earned date for user
  const userBadges = badges.map(badge => {
    const userEarned = badge.earnedBy.find(
      earned => earned.user.toString() === req.user._id.toString()
    );

    return {
      ...badge.toJSON(),
      earnedAt: userEarned.earnedAt,
    };
  });

  res.status(200).json({
    success: true,
    data: userBadges,
  });
});

// @desc    Check and award eligible badges
// @route   POST /api/badges/check-eligibility
// @access  Private
export const checkBadgeEligibility = asyncHandler(async (req, res) => {
  const earnedBadges = await Badge.checkBadgeEligibility(req.user._id, User);

  if (earnedBadges.length > 0) {
    // Update user's achievements
    const user = await User.findById(req.user._id);
    earnedBadges.forEach(badge => {
      user.achievements.push({
        title: badge.name,
        description: badge.description,
        icon: badge.icon,
      });
    });
    await user.save();
  }

  res.status(200).json({
    success: true,
    message: earnedBadges.length > 0 
      ? `Congratulations! You earned ${earnedBadges.length} new badge(s)!`
      : 'No new badges earned at this time',
    data: earnedBadges,
  });
});

// Admin functions

// @desc    Create new badge
// @route   POST /api/badges
// @access  Private (Admin)
export const createBadge = asyncHandler(async (req, res) => {
  const badge = await Badge.create(req.body);

  res.status(201).json({
    success: true,
    message: 'Badge created successfully',
    data: badge,
  });
});

// @desc    Update badge
// @route   PUT /api/badges/:id
// @access  Private (Admin)
export const updateBadge = asyncHandler(async (req, res) => {
  const badge = await Badge.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!badge) {
    return res.status(404).json({
      success: false,
      message: 'Badge not found',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Badge updated successfully',
    data: badge,
  });
});

// @desc    Delete badge
// @route   DELETE /api/badges/:id
// @access  Private (Admin)
export const deleteBadge = asyncHandler(async (req, res) => {
  const badge = await Badge.findById(req.params.id);

  if (!badge) {
    return res.status(404).json({
      success: false,
      message: 'Badge not found',
    });
  }

  await Badge.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Badge deleted successfully',
  });
});

// @desc    Manually award badge to user
// @route   POST /api/badges/:id/award
// @access  Private (Admin)
export const awardBadge = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  const badge = await Badge.findById(req.params.id);

  if (!badge) {
    return res.status(404).json({
      success: false,
      message: 'Badge not found',
    });
  }

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Check if user already has this badge
  const alreadyEarned = badge.earnedBy.some(
    earned => earned.user.toString() === userId.toString()
  );

  if (alreadyEarned) {
    return res.status(400).json({
      success: false,
      message: 'User already has this badge',
    });
  }

  // Award badge
  badge.earnedBy.push({ user: userId });
  await badge.save();

  // Award points if specified
  if (badge.rewards.points > 0) {
    await user.addPoints(badge.rewards.points, `Earned badge: ${badge.name}`);
  }

  // Add to user achievements
  user.achievements.push({
    title: badge.name,
    description: badge.description,
    icon: badge.icon,
  });
  await user.save();

  // Trigger badge earned webhook
  setTimeout(async () => {
    try {
      await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhooks/zapier/badge_earned`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.PLATFORM_API_KEY,
        },
        body: JSON.stringify({
          userId,
          badgeName: badge.name,
          badgeDescription: badge.description,
          pointsAwarded: badge.rewards.points,
        }),
      });
    } catch (error) {
      console.log('Badge earned webhook failed:', error.message);
    }
  }, 1000);

  res.status(200).json({
    success: true,
    message: 'Badge awarded successfully',
  });
});