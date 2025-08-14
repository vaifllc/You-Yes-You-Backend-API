import Challenge from '../models/Challenge.js';
import Badge from '../models/Badge.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// @desc    Get all challenges
// @route   GET /api/challenges
// @access  Private
export const getChallenges = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 12, 
    type, 
    phase,
    category,
    status = 'active',
    search 
  } = req.query;

  // Build query
  const query = { isPublished: true };
  
  if (status === 'active') {
    query.isActive = true;
    query.endDate = { $gte: new Date() };
  } else if (status === 'completed') {
    query.endDate = { $lt: new Date() };
  }
  
  if (type && type !== 'all') {
    query.type = type;
  }
  
  if (phase && phase !== 'all') {
    query.phase = phase;
  }
  
  if (category && category !== 'all') {
    query.category = category;
  }
  
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const challenges = await Challenge.find(query)
    .populate('createdBy', 'name username')
    .sort({ startDate: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Add user participation status
  if (req.user) {
    challenges.forEach(challenge => {
      const userParticipation = challenge.participants?.find(
        p => p.user.toString() === req.user._id.toString()
      );
      challenge.isUserParticipating = !!userParticipation;
      challenge.userProgress = userParticipation ? userParticipation.progress : 0;
      challenge.userCompleted = userParticipation ? userParticipation.isCompleted : false;
    });
  }

  const total = await Challenge.countDocuments(query);

  res.status(200).json({
    success: true,
    data: challenges,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Get single challenge
// @route   GET /api/challenges/:id
// @access  Private
export const getChallenge = asyncHandler(async (req, res) => {
  const challenge = await Challenge.findById(req.params.id)
    .populate('createdBy', 'name username avatar')
    .populate('participants.user', 'name username avatar level');

  if (!challenge) {
    return res.status(404).json({
      success: false,
      message: 'Challenge not found',
    });
  }

  // Check user participation
  let userParticipation = null;
  if (req.user) {
    userParticipation = challenge.participants.find(
      p => p.user._id.toString() === req.user._id.toString()
    );
  }

  res.status(200).json({
    success: true,
    data: {
      ...challenge.toJSON(),
      userParticipation,
    },
  });
});

// @desc    Join challenge
// @route   POST /api/challenges/:id/join
// @access  Private
export const joinChallenge = asyncHandler(async (req, res) => {
  const challenge = await Challenge.findById(req.params.id);

  if (!challenge) {
    return res.status(404).json({
      success: false,
      message: 'Challenge not found',
    });
  }

  // Check if challenge is active and hasn't ended
  if (!challenge.isActive || challenge.endDate < new Date()) {
    return res.status(400).json({
      success: false,
      message: 'Challenge is not active or has ended',
    });
  }

  // Check if user already joined
  const existingParticipant = challenge.participants.find(
    p => p.user.toString() === req.user._id.toString()
  );

  if (existingParticipant) {
    return res.status(400).json({
      success: false,
      message: 'Already participating in this challenge',
    });
  }

  await challenge.addParticipant(req.user._id);

  // Award points for joining
  await req.user.addPoints(5, `Joined challenge: ${challenge.title}`);

  res.status(200).json({
    success: true,
    message: 'Successfully joined challenge',
  });
});

// @desc    Update challenge progress
// @route   PUT /api/challenges/:id/progress
// @access  Private
export const updateChallengeProgress = asyncHandler(async (req, res) => {
  const { taskDay, completed } = req.body;

  const challenge = await Challenge.findById(req.params.id);

  if (!challenge) {
    return res.status(404).json({
      success: false,
      message: 'Challenge not found',
    });
  }

  const participant = challenge.participants.find(
    p => p.user.toString() === req.user._id.toString()
  );

  if (!participant) {
    return res.status(400).json({
      success: false,
      message: 'Not participating in this challenge',
    });
  }

  if (completed && !participant.completedTasks.includes(taskDay)) {
    await challenge.updateProgress(req.user._id, taskDay);
    
    // Award points for task completion
    await req.user.addPoints(5, `Completed day ${taskDay} of ${challenge.title}`);
    
    // Check if challenge is now completed
    if (participant.progress >= 100) {
      await req.user.addPoints(challenge.rewards.points, `Completed challenge: ${challenge.title}`);
      
      // Trigger challenge completion webhook
      setTimeout(async () => {
        try {
          await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhooks/zapier/challenge_completed`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': process.env.PLATFORM_API_KEY,
            },
            body: JSON.stringify({
              userId: req.user._id,
              challengeId: challenge._id,
              challengeTitle: challenge.title,
              completionDate: new Date(),
            }),
          });
        } catch (error) {
          console.log('Challenge completion webhook failed:', error.message);
        }
      }, 1000);
      
      // Award badge if specified
      if (challenge.rewards.badge.name) {
        const newBadge = await Badge.findOneAndUpdate(
          { name: challenge.rewards.badge.name },
          {
            name: challenge.rewards.badge.name,
            description: challenge.rewards.badge.description,
            icon: challenge.rewards.badge.icon,
            category: 'Achievement',
            criteria: { type: 'custom', value: 1, operator: '>=' },
          },
          { upsert: true, new: true }
        );
        
        if (!newBadge.earnedBy.some(earned => earned.user.toString() === req.user._id.toString())) {
          newBadge.earnedBy.push({ user: req.user._id });
          await newBadge.save();
        }
      }
    }
  }

  res.status(200).json({
    success: true,
    message: 'Progress updated successfully',
    data: {
      progress: participant.progress,
      completedTasks: participant.completedTasks,
      isCompleted: participant.isCompleted,
    },
  });
});

// @desc    Get user's challenges
// @route   GET /api/challenges/my-challenges
// @access  Private
export const getUserChallenges = asyncHandler(async (req, res) => {
  const { status = 'active' } = req.query;

  let query = {
    'participants.user': req.user._id,
  };

  if (status === 'active') {
    query.endDate = { $gte: new Date() };
  } else if (status === 'completed') {
    query.endDate = { $lt: new Date() };
  }

  const challenges = await Challenge.find(query)
    .populate('createdBy', 'name username');

  // Add user-specific data
  const userChallenges = challenges.map(challenge => {
    const userParticipation = challenge.participants.find(
      p => p.user.toString() === req.user._id.toString()
    );

    return {
      ...challenge.toJSON(),
      userProgress: userParticipation.progress,
      userCompletedTasks: userParticipation.completedTasks,
      userIsCompleted: userParticipation.isCompleted,
      userJoinedAt: userParticipation.joinedAt,
      userCompletedAt: userParticipation.completedAt,
    };
  });

  res.status(200).json({
    success: true,
    data: userChallenges,
  });
});

// Admin functions

// @desc    Create new challenge
// @route   POST /api/challenges
// @access  Private (Admin)
export const createChallenge = asyncHandler(async (req, res) => {
  const challengeData = {
    ...req.body,
    createdBy: req.user._id,
  };

  const challenge = await Challenge.create(challengeData);

  res.status(201).json({
    success: true,
    message: 'Challenge created successfully',
    data: challenge,
  });
});

// @desc    Update challenge
// @route   PUT /api/challenges/:id
// @access  Private (Admin)
export const updateChallenge = asyncHandler(async (req, res) => {
  const challenge = await Challenge.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!challenge) {
    return res.status(404).json({
      success: false,
      message: 'Challenge not found',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Challenge updated successfully',
    data: challenge,
  });
});

// @desc    Delete challenge
// @route   DELETE /api/challenges/:id
// @access  Private (Admin)
export const deleteChallenge = asyncHandler(async (req, res) => {
  const challenge = await Challenge.findById(req.params.id);

  if (!challenge) {
    return res.status(404).json({
      success: false,
      message: 'Challenge not found',
    });
  }

  await Challenge.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Challenge deleted successfully',
  });
});

// @desc    Get challenge leaderboard
// @route   GET /api/challenges/:id/leaderboard
// @access  Private
export const getChallengeLeaderboard = asyncHandler(async (req, res) => {
  const challenge = await Challenge.findById(req.params.id)
    .populate('participants.user', 'name username avatar level');

  if (!challenge) {
    return res.status(404).json({
      success: false,
      message: 'Challenge not found',
    });
  }

  // Sort participants by progress and completion
  const leaderboard = challenge.participants
    .sort((a, b) => {
      if (a.isCompleted && !b.isCompleted) return -1;
      if (!a.isCompleted && b.isCompleted) return 1;
      return b.progress - a.progress;
    })
    .slice(0, 50); // Top 50

  res.status(200).json({
    success: true,
    data: {
      challenge: {
        title: challenge.title,
        type: challenge.type,
        duration: challenge.duration,
      },
      leaderboard,
    },
  });
});