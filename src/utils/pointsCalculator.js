export const POINT_VALUES = {
  DAILY_LOGIN: 2,
  CREATE_POST: 5,
  COMMENT_POST: 3,
  COMPLETE_MODULE: 10,
  COMPLETE_COURSE: 50,
  ATTEND_EVENT: 15,
  SHARE_WIN: 20,
  COMPLETE_CHALLENGE: 25,
  ACCOUNT_REGISTRATION: 10,
  RSVP_EVENT: 5,
  LIKE_POST: 1,
  PROFILE_COMPLETION: 15,
  FIRST_POST: 10,
  WEEKLY_STREAK: 50,
  MONTHLY_STREAK: 100,
  DAILY_CHALLENGE_TASK: 5,
  BADGE_EARNED: 20,
  HELP_ANOTHER_MEMBER: 15,
  SHARE_RESOURCE: 10,
  ATTEND_BONUS_SESSION: 20,
};

export const LEVEL_THRESHOLDS = {
  'New Member': { min: 0, max: 99 },
  'Builder': { min: 100, max: 249 },
  'Overcomer': { min: 250, max: 499 },
  'Mentor-in-Training': { min: 500, max: 749 },
  'Legacy Leader': { min: 750, max: Infinity },
};

export const calculateLevel = (points) => {
  for (const [level, threshold] of Object.entries(LEVEL_THRESHOLDS)) {
    if (points >= threshold.min && points <= threshold.max) {
      return level;
    }
  }
  return 'New Member';
};

export const getNextLevelInfo = (currentPoints) => {
  const currentLevel = calculateLevel(currentPoints);
  const levels = Object.keys(LEVEL_THRESHOLDS);
  const currentIndex = levels.indexOf(currentLevel);
  
  if (currentIndex === levels.length - 1) {
    return {
      isMaxLevel: true,
      nextLevel: null,
      pointsToNext: 0,
      progress: 100,
    };
  }
  
  const nextLevel = levels[currentIndex + 1];
  const nextThreshold = LEVEL_THRESHOLDS[nextLevel];
  const currentThreshold = LEVEL_THRESHOLDS[currentLevel];
  
  const pointsToNext = nextThreshold.min - currentPoints;
  const progressRange = nextThreshold.min - currentThreshold.min;
  const currentProgress = currentPoints - currentThreshold.min;
  const progress = (currentProgress / progressRange) * 100;
  
  return {
    isMaxLevel: false,
    nextLevel,
    pointsToNext,
    progress: Math.min(100, Math.max(0, progress)),
  };
};

export const awardPoints = async (user, action, customPoints = null) => {
  const points = customPoints || POINT_VALUES[action] || 0;
  
  if (points > 0) {
    const oldLevel = user.level;
    await user.addPoints(points, action);
    const newLevel = user.level;
    
    // Check if user leveled up
    const leveledUp = oldLevel !== newLevel;
    
    return {
      pointsAwarded: points,
      newTotal: user.points,
      leveledUp,
      oldLevel,
      newLevel,
    };
  }
  
  return null;
};

export const getPointsLeaderboard = async (User, timeframe = 'all-time', limit = 50) => {
  let matchStage = {};
  
  // Calculate date range for timeframe
  if (timeframe !== 'all-time') {
    const now = new Date();
    let startDate;
    
    switch (timeframe) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // Beginning of time
    }
    
    matchStage = {
      'pointsHistory.timestamp': { $gte: startDate }
    };
  }

  const pipeline = [
    {
      $addFields: {
        relevantPoints: {
          $cond: {
            if: timeframe === 'all-time',
            then: '$points',
            else: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$pointsHistory',
                      cond: matchStage['pointsHistory.timestamp'] 
                        ? { $gte: ['$$this.timestamp', matchStage['pointsHistory.timestamp'].$gte] }
                        : true
                    }
                  },
                  as: 'history',
                  in: '$$history.points'
                }
              }
            }
          }
        }
      }
    },
    {
      $sort: { relevantPoints: -1 }
    },
    {
      $limit: limit
    },
    {
      $project: {
        name: 1,
        username: 1,
        avatar: 1,
        level: 1,
        phase: 1,
        isOnline: 1,
        points: '$relevantPoints',
        totalPoints: '$points',
      }
    }
  ];

  return await User.aggregate(pipeline);
};

export default {
  POINT_VALUES,
  LEVEL_THRESHOLDS,
  calculateLevel,
  getNextLevelInfo,
  awardPoints,
  getPointsLeaderboard,
};