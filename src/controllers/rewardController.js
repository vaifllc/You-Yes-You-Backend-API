import Reward from '../models/Reward.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// @desc    Get all rewards
// @route   GET /api/rewards
// @access  Private
export const getRewards = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    type,
    category,
    available = true,
    search
  } = req.query;

  // Build query
  const query = {};

  if (available === 'true') {
    query['availability.isActive'] = true;
    const now = new Date();
    query.$or = [
      { 'availability.startDate': { $exists: false } },
      { 'availability.startDate': { $lte: now } },
    ];
    query.$and = [
      {
        $or: [
          { 'availability.endDate': { $exists: false } },
          { 'availability.endDate': { $gte: now } },
        ]
      }
    ];
  }

  if (type && type !== 'all') {
    query.type = type;
  }

  if (category && category !== 'all') {
    query.category = category;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const rewards = await Reward.find(query)
    .sort({ pointsCost: 1, category: 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Add user eligibility and claim status
  if (req.user) {
    rewards.forEach(reward => {
      const canClaim = Reward.prototype.canUserClaim.call(reward, req.user);
      reward.canUserClaim = canClaim.canClaim;
      reward.claimReason = canClaim.reason;
      reward.userHasClaimed = reward.claimedBy?.some(
        claim => claim.user.toString() === req.user._id.toString()
      ) || false;
    });
  }

  const total = await Reward.countDocuments(query);

  res.status(200).json({
    success: true,
    data: rewards,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Get single reward
// @route   GET /api/rewards/:id
// @access  Private
export const getReward = asyncHandler(async (req, res) => {
  const reward = await Reward.findById(req.params.id);

  if (!reward) {
    return res.status(404).json({
      success: false,
      message: 'Reward not found',
    });
  }

  // Check if user can claim
  const eligibility = reward.canUserClaim(req.user);

  res.status(200).json({
    success: true,
    data: {
      ...reward.toJSON(),
      eligibility,
    },
  });
});

// @desc    Claim reward
// @route   POST /api/rewards/:id/claim
// @access  Private
export const claimReward = asyncHandler(async (req, res) => {
  const { shippingAddress } = req.body;

  const reward = await Reward.findById(req.params.id);

  if (!reward) {
    return res.status(404).json({
      success: false,
      message: 'Reward not found',
    });
  }

  // Check eligibility
  const eligibility = reward.canUserClaim(req.user);
  if (!eligibility.canClaim) {
    return res.status(400).json({
      success: false,
      message: eligibility.reason,
    });
  }

  // Deduct points from user
  const user = await User.findById(req.user._id);
  user.points -= reward.pointsCost;
  user.pointsHistory.push({
    action: `Claimed reward: ${reward.name}`,
    points: -reward.pointsCost,
  });
  await user.save();

  // Claim reward
  const claim = await reward.claimReward(req.user._id, shippingAddress);

  res.status(200).json({
    success: true,
    message: 'Reward claimed successfully',
    data: {
      reward: reward.name,
      pointsSpent: reward.pointsCost,
      remainingPoints: user.points,
      claimId: claim._id,
    },
  });
});

// @desc    Get user's claimed rewards
// @route   GET /api/rewards/my-rewards
// @access  Private
export const getUserRewards = asyncHandler(async (req, res) => {
  const rewards = await Reward.find({
    'claimedBy.user': req.user._id,
  }).select('name type category value claimedBy images');

  // Filter to show only user's claims
  const userRewards = rewards.map(reward => {
    const userClaim = reward.claimedBy.find(
      claim => claim.user.toString() === req.user._id.toString()
    );

    return {
      _id: reward._id,
      name: reward.name,
      type: reward.type,
      category: reward.category,
      value: reward.value,
      images: reward.images,
      claimedAt: userClaim.claimedAt,
      status: userClaim.status,
      shippingInfo: userClaim.shippingInfo,
    };
  });

  res.status(200).json({
    success: true,
    data: userRewards,
  });
});

// Admin functions

// @desc    Create new reward
// @route   POST /api/rewards
// @access  Private (Admin)
export const createReward = asyncHandler(async (req, res) => {
  const reward = await Reward.create(req.body);

  res.status(201).json({
    success: true,
    message: 'Reward created successfully',
    data: reward,
  });
});

// @desc    Update reward
// @route   PUT /api/rewards/:id
// @access  Private (Admin)
export const updateReward = asyncHandler(async (req, res) => {
  const reward = await Reward.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!reward) {
    return res.status(404).json({
      success: false,
      message: 'Reward not found',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Reward updated successfully',
    data: reward,
  });
});

// @desc    Delete reward
// @route   DELETE /api/rewards/:id
// @access  Private (Admin)
export const deleteReward = asyncHandler(async (req, res) => {
  const reward = await Reward.findById(req.params.id);

  if (!reward) {
    return res.status(404).json({
      success: false,
      message: 'Reward not found',
    });
  }

  await reward.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Reward deleted successfully',
  });
});

// @desc    Get reward claims for admin
// @route   GET /api/rewards/admin/claims
// @access  Private (Admin)
export const getRewardClaims = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const pipeline = [
    { $unwind: '$claimedBy' },
    { $match: status ? { 'claimedBy.status': status } : {} },
    {
      $lookup: {
        from: 'users',
        localField: 'claimedBy.user',
        foreignField: '_id',
        as: 'user',
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        rewardName: '$name',
        rewardType: '$type',
        rewardValue: '$value',
        claimedAt: '$claimedBy.claimedAt',
        status: '$claimedBy.status',
        shippingInfo: '$claimedBy.shippingInfo',
        user: {
          name: '$user.name',
          username: '$user.username',
          email: '$user.email',
          avatar: '$user.avatar',
        },
      }
    },
    { $sort: { claimedAt: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: parseInt(limit) },
  ];

  const claims = await Reward.aggregate(pipeline);
  const total = await Reward.aggregate([
    { $unwind: '$claimedBy' },
    { $match: status ? { 'claimedBy.status': status } : {} },
    { $count: 'total' },
  ]);

  res.status(200).json({
    success: true,
    data: claims,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil((total[0]?.total || 0) / limit),
      total: total[0]?.total || 0,
      hasNext: page < Math.ceil((total[0]?.total || 0) / limit),
      hasPrev: page > 1,
    },
  });
});