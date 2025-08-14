import User from '../models/User.js';

// Track different types of streaks
export const STREAK_TYPES = {
  LOGIN: 'login',
  POST: 'post',
  EVENT: 'event',
  CHALLENGE: 'challenge',
  COURSE: 'course',
};

// Streak rewards
export const STREAK_REWARDS = {
  [STREAK_TYPES.LOGIN]: {
    7: { points: 25, badge: 'Weekly Warrior' },
    14: { points: 50, badge: 'Consistency Champion' },
    30: { points: 100, badge: 'Monthly Master' },
    100: { points: 250, badge: 'Century Streak' },
  },
  [STREAK_TYPES.POST]: {
    7: { points: 35, badge: 'Content Creator' },
    14: { points: 70, badge: 'Community Voice' },
    30: { points: 150, badge: 'Thought Leader' },
  },
  [STREAK_TYPES.EVENT]: {
    5: { points: 40, badge: 'Event Enthusiast' },
    10: { points: 80, badge: 'Community Participant' },
    20: { points: 160, badge: 'Event Master' },
  },
};

// Update user streak
export const updateStreak = async (userId, streakType, action = 'increment') => {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    // Initialize streaks if not exists
    if (!user.streaks) {
      user.streaks = {};
    }
    
    if (!user.streaks[streakType]) {
      user.streaks[streakType] = {
        current: 0,
        longest: 0,
        lastUpdate: null,
      };
    }

    const streak = user.streaks[streakType];
    const today = new Date().toDateString();
    const lastUpdate = streak.lastUpdate ? streak.lastUpdate.toDateString() : null;

    if (action === 'increment') {
      // Check if it's a new day
      if (lastUpdate !== today) {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
        
        if (lastUpdate === yesterday) {
          // Continue streak
          streak.current += 1;
        } else {
          // Start new streak
          streak.current = 1;
        }
        
        streak.lastUpdate = new Date();
        
        // Update longest streak
        if (streak.current > streak.longest) {
          streak.longest = streak.current;
        }
        
        // Check for streak rewards
        const reward = STREAK_REWARDS[streakType]?.[streak.current];
        if (reward) {
          await user.addPoints(reward.points, `${streak.current}-day ${streakType} streak!`);
          
          // Award badge if specified
          if (reward.badge) {
            const Badge = (await import('../models/Badge.js')).default;
            await Badge.findOneAndUpdate(
              { name: reward.badge },
              {
                name: reward.badge,
                description: `Achieved ${streak.current}-day ${streakType} streak`,
                icon: getStreakIcon(streakType),
                category: 'Streak',
                criteria: { type: 'streak', value: streak.current, operator: '>=' },
                rarity: getStreakRarity(streak.current),
              },
              { upsert: true }
            );
          }
        }
        
        await user.save();
        return streak;
      }
    } else if (action === 'reset') {
      streak.current = 0;
      streak.lastUpdate = new Date();
      await user.save();
      return streak;
    }

    return streak;
  } catch (error) {
    console.error('Error updating streak:', error);
    return null;
  }
};

// Check for broken streaks (daily job)
export const checkBrokenStreaks = async () => {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const users = await User.find({
      'streaks.login.current': { $gt: 0 },
      'streaks.login.lastUpdate': { $lt: yesterday },
    });

    for (const user of users) {
      // Reset login streak if no activity yesterday
      if (user.streaks?.login?.current > 0) {
        user.streaks.login.current = 0;
        await user.save();
      }
    }

    console.log(`✅ Checked ${users.length} users for broken streaks`);
  } catch (error) {
    console.error('❌ Error checking broken streaks:', error);
  }
};

// Get streak icon based on type
const getStreakIcon = (streakType) => {
  const icons = {
    login: '🔥',
    post: '✍️',
    event: '📅',
    challenge: '🏆',
    course: '📚',
  };
  return icons[streakType] || '⭐';
};

// Get streak rarity based on length
const getStreakRarity = (streakLength) => {
  if (streakLength >= 100) return 'Legendary';
  if (streakLength >= 30) return 'Epic';
  if (streakLength >= 14) return 'Rare';
  if (streakLength >= 7) return 'Uncommon';
  return 'Common';
};

// Get user streak summary
export const getUserStreakSummary = async (userId) => {
  try {
    const user = await User.findById(userId).select('streaks');
    if (!user || !user.streaks) {
      return {
        login: { current: 0, longest: 0 },
        post: { current: 0, longest: 0 },
        event: { current: 0, longest: 0 },
        challenge: { current: 0, longest: 0 },
      };
    }

    return user.streaks;
  } catch (error) {
    console.error('Error getting streak summary:', error);
    return null;
  }
};

export default {
  STREAK_TYPES,
  STREAK_REWARDS,
  updateStreak,
  checkBrokenStreaks,
  getUserStreakSummary,
};