
import { UserProfile } from './types';
import { EXTENDED_DAILY_QUESTIONS } from './questions';

export const ICONS = {
  LOGO: "/Graphics/Icon.png?v=2", 
  TITLE: "/Graphics/LitterLookerTitle.png?v=2",
  HOME: "/Graphics/Home.png?v=2",
  MAP: "/Graphics/Map.png?v=2",
  LEADERBOARD: "/Graphics/Leaderboard.png?v=2",
  COMMUNITY: "/Graphics/Community.png?v=2",
  PROFILE: "/Graphics/Profile.png?v=2"
};

export const INFINITY_XP = -1;
export const INFINITY_SYMBOL = '∞';

export type Rarity = 'Common' | 'Rare' | 'Legendary';

export const TITLE_RARITY_MAP: Record<string, Rarity> = {
  'Incinerator': 'Legendary',
  'Eco Warrior': 'Common',
  'Mender': 'Common',
  'Pathfinder': 'Rare',
  'The First Step': 'Common',
  'Hello World': 'Common',
  'Over here!': 'Common',
  'Awesome!': 'Rare',
  'Teamworker': 'Rare',
  'Veteran': 'Legendary',
  'Mend The Earth': 'Legendary',
  'Quadruple': 'Common',
  'Quintuple': 'Rare',
  'Hextuple': 'Legendary',
  'Leader of the Board': 'Legendary',
  'Imperial': 'Legendary',
  'The Immaculate': 'Legendary',
  'Primordial': 'Legendary',
  'Organizer': 'Legendary',
  'Participator': 'Rare',
  'Superior': 'Legendary'
};

export const AVAILABLE_TAGS = ['Creator', 'Tester'];

export interface AssetReward {
  id: string;
  name: string;
  type: 'profile_border' | 'post_border' | 'pin_design' | 'app_skin' | 'username_color' | 'username_gradient' | 'username_shine' | 'ability';
}

export const RANK_SYSTEM = [
  { level: 1, name: "Litter Looker", threshold: 0, rewards: [] },
  { level: 2, name: "Scrap Scout", threshold: 25000, rewards: [
      { id: 'ability_voting', name: 'Voting', type: 'ability' }
    ] 
  },
  { level: 3, name: "Trash Tracker", threshold: 50000, rewards: [
      { id: 'uc_blue', name: 'Blue Username', type: 'username_color' },
      { id: 'ability_join_crew', name: 'Join Cleanup Crew', type: 'ability' }
    ] 
  },
  { level: 4, name: "Garbage Guardian", threshold: 75000, rewards: [
      { id: 'ability_create_crew', name: 'Create Cleanup Crew', type: 'ability' }
    ] 
  },
  { level: 5, name: "Chief Cleaner", threshold: 100000, rewards: [
      { id: 'ability_scheduling', name: 'Cleanup Scheduling', type: 'ability' },
      { id: 'uc_purple', name: 'Purple Username', type: 'username_color' },
      { id: 'ug_blue', name: 'Blue Gradient Username', type: 'username_gradient' }
    ] 
  },
  { level: 6, name: "Waste Warden", threshold: 150000, rewards: [] },
  { level: 7, name: "Debris Destroyer", threshold: 200000, rewards: [
      { id: 'ug_purple', name: 'Purple Gradient Username', type: 'username_gradient' }
    ] 
  },
  { level: 8, name: "Clutter Commander", threshold: 250000, rewards: [
      { id: 'uc_red', name: 'Red Username', type: 'username_color' }
    ] 
  },
  { level: 9, name: "Landfill Lord", threshold: 300000, rewards: [] },
  { level: 10, name: "Junk General", threshold: 350000, rewards: [
      { id: 'uc_gold', name: 'Gold Username', type: 'username_color' },
      { id: 'ug_red', name: 'Red Gradient Username', type: 'username_gradient' }
    ] 
  },
  { level: 11, name: "Sweeper Supreme", threshold: 425000, rewards: [] },
  { level: 12, name: "Terra Master", threshold: 500000, rewards: [] },
  { level: 13, name: "Royal Recycler", threshold: 575000, rewards: [
      { id: 'ug_gold', name: 'Gold Gradient Username', type: 'username_gradient' }
    ] 
  },
  { level: 14, name: "Planet Protector", threshold: 650000, rewards: [] },
  { level: 15, name: "Litter Legend", threshold: 725000, rewards: [
      { id: 'us_shine', name: 'Username Shine', type: 'username_shine' }
    ] 
  }
];

export interface Achievement {
  id: string;
  title: string;
  description: string;
  rarity: Rarity;
  reward: number;
  givesTitle?: boolean;
  givesAsset?: AssetReward;
  target: number;
  hidden?: boolean;
  check: (user: UserProfile, allUsers: Record<string, UserProfile>) => boolean;
  getProgress: (user: UserProfile, allUsers: Record<string, UserProfile>) => number;
}

export const ACHIEVEMENTS_DATA: Achievement[] = [
  { id: 'hello_world', title: 'Hello World', description: 'Make your first community post', rarity: 'Common', reward: 1500, target: 1, check: (user) => (user.postsCount || 0) >= 1, getProgress: (user) => user.postsCount || 0 },
  { id: 'identity_crisis', title: 'Identity Crisis', description: 'Change your username 5 times', rarity: 'Common', reward: 1500, target: 5, hidden: true, check: (user) => (user.usernameChangeCount || 0) >= 5, getProgress: (user) => user.usernameChangeCount || 0 },
  { id: 'over_here', title: 'Over here!', description: 'Add a pin to your community post', rarity: 'Common', reward: 1500, givesAsset: { id: 'pin_flower', name: 'Flower Pin', type: 'pin_design' }, target: 1, check: (user) => (user.linkedPostsCount || 0) >= 1, getProgress: (user) => user.linkedPostsCount || 0 },
  { id: 'quadruple', title: 'Quadruple', description: 'Collect 1000 XP', rarity: 'Common', reward: 1500, givesTitle: true, target: 1000, check: (user) => user.totalXP >= 1000, getProgress: (user) => user.totalXP },
  { id: 'the_first_step', title: 'The First Step', description: 'Submit your first pin', rarity: 'Common', reward: 1500, target: 1, check: (user) => (user.pinsSubmittedCount || 0) >= 1, getProgress: (user: UserProfile) => user.pinsSubmittedCount || 0 },
  { id: 'vocal', title: 'Vocal', description: 'Comment on 20 community posts', rarity: 'Common', reward: 1500, target: 20, check: (user) => (user.commentsCount || 0) >= 20, getProgress: (user) => user.commentsCount || 0 },
  { id: 'who_am_i', title: 'Who am I?', description: 'Change your profile picture 5 times', rarity: 'Common', reward: 1500, target: 5, hidden: true, check: (user) => (user.profilePictureChangeCount || 0) >= 5, getProgress: (user) => user.profilePictureChangeCount || 0 },
  { id: 'friendly', title: 'Friendly', description: 'Add 10 friends', rarity: 'Common', reward: 1500, target: 10, check: (user) => (user.friends || []).length >= 10, getProgress: (user) => (user.friends || []).length },
  { id: 'bonus', title: 'Overflow', description: 'Report pin progress in a multiplier zone', rarity: 'Rare', reward: 4000, target: 1, check: (user) => (user.multiplierReportsCount || 0) >= 1, getProgress: (user) => user.multiplierReportsCount || 0 },
  { id: 'awesome', title: 'Awesome!', description: 'Receive a total of 200 reactions on your community posts', rarity: 'Rare', reward: 4000, givesTitle: true, target: 200, check: (user) => (user.totalReactionsReceived || 0) >= 200, getProgress: (user) => user.totalReactionsReceived || 0 },
  { 
    id: 'high_society', 
    title: 'High Society', 
    description: 'Add a friend that has an official tag', 
    rarity: 'Legendary', 
    reward: 6500, 
    target: 1, 
    hidden: true, 
    check: (user, allUsers) => (user.friends || []).some(fId => { 
      const friend = allUsers[fId]; 
      return friend && (
        (friend.tags || []).some(t => AVAILABLE_TAGS.includes(t)) || 
        friend.permissions?.isCreator || 
        friend.permissions?.isTester
      ); 
    }), 
    getProgress: (user, allUsers) => (user.friends || []).some(fId => { 
      const friend = allUsers[fId]; 
      return friend && (
        (friend.tags || []).some(t => AVAILABLE_TAGS.includes(t)) || 
        friend.permissions?.isCreator || 
        friend.permissions?.isTester
      ); 
    }) ? 1 : 0 
  },
  { id: 'familiar', title: 'Familiar', description: 'Open the app 100 times', rarity: 'Rare', reward: 4000, target: 100, hidden: true, check: (user) => (user.appOpenCount || 0) >= 100, getProgress: (user) => user.appOpenCount || 0 },
  { id: 'popular', title: 'Popular', description: 'Get tagged 5 times', rarity: 'Rare', reward: 4000, target: 5, check: (user) => (user.timesTaggedCount || 0) >= 5, getProgress: (user) => user.timesTaggedCount || 0 },
  { id: 'quintuple', title: 'Quintuple', description: 'Collect 10000 XP', rarity: 'Rare', reward: 4000, givesTitle: true, target: 10000, check: (user) => user.totalXP >= 10000, getProgress: (user) => user.totalXP },
  { id: 'rulebreaker', title: 'Rulebreaker', description: 'Receive 15 total warnings', rarity: 'Rare', reward: 4000, target: 15, hidden: true, check: (user) => (user.totalWarningsReceived || 0) >= 15, getProgress: (user) => user.totalWarningsReceived || 0 },
  { id: 'something_to_say', title: 'Something to Say', description: 'Reach 50 total comments on one post', rarity: 'Rare', reward: 4000, target: 50, check: (user) => (user.maxCommentsReceived || 0) >= 50, getProgress: (user) => user.maxCommentsReceived || 0 },
  { id: 'stronger_together', title: 'Stronger Together', description: 'Join a Cleanup Crew', rarity: 'Common', reward: 1500, target: 1, check: (user) => !!user.teamId, getProgress: (user) => user.teamId ? 1 : 0 },
  { 
    id: 'quintessential', 
    title: 'Quintessential', 
    description: 'Rank #1 in the Global Rankings', 
    rarity: 'Legendary', 
    reward: 6500, 
    target: 1, 
    hidden: true, 
    check: (user) => (user.globalRank_weight === 1 || user.globalRank_area === 1 || user.globalRank_pieces === 1), 
    getProgress: (user) => (user.globalRank_weight === 1 || user.globalRank_area === 1 || user.globalRank_pieces === 1) ? 1 : 0 
  },
  { id: 'teamworker', title: 'Teamworker', description: 'Tag a total of 50 other users', rarity: 'Rare', reward: 4000, givesTitle: true, givesAsset: { id: 'pin_globe', name: 'Globe Pin', type: 'pin_design' }, target: 50, check: (user) => (user.totalUsersTaggedCount || 0) >= 50, getProgress: (user) => user.totalUsersTaggedCount || 0 },
  { id: 'welcome_back', title: 'Welcome Back', description: 'Received 50 missed notifications at once', rarity: 'Rare', reward: 4000, target: 50, hidden: true, check: (user) => (user.maxMissedCount || 0) >= 50, getProgress: (user) => user.maxMissedCount || 0 },
  { id: 'participator', title: 'Participator', description: 'Participate in 3 group cleanups with over 75% efficiency', rarity: 'Rare', reward: 4000, givesTitle: true, target: 3, check: (user) => (user.highEfficiencyParticipationsCount || 0) >= 3, getProgress: (user) => user.highEfficiencyParticipationsCount || 0 },
  { id: 'gatherer', title: 'Gatherer', description: 'Earn 5000 XP in one day 10 times', rarity: 'Rare', reward: 4000, target: 10, check: (user) => (user.daily5000XPCount || 0) >= 10, getProgress: (user) => user.daily5000XPCount || 0 },
  { id: 'community_spark', title: 'Community Spark', description: 'Invite a friend to LitterLooker', rarity: 'Rare', reward: 4000, givesTitle: true, target: 1, check: (user) => !!user.hasInvitedFriend, getProgress: (user) => user.hasInvitedFriend ? 1 : 0 },
  { id: 'famous', title: 'Famous', description: 'Become Verified', rarity: 'Legendary', reward: 6500, target: 1, hidden: true, check: (user) => !!user.permissions?.isVerified, getProgress: (user) => user.permissions?.isVerified ? 1 : 0 },
  { id: 'hextuple', title: 'Hextuple', description: 'Collect 100000 XP', rarity: 'Legendary', reward: 6500, givesTitle: true, givesAsset: { id: 'pin_broom', name: 'Broom Pin', type: 'pin_design' }, target: 100000, check: (user) => user.totalXP >= 100000, getProgress: (user) => user.totalXP },
  { id: 'imperial', title: 'Imperial', description: 'Collect 1000000 XP', rarity: 'Legendary', reward: 6500, givesTitle: true, target: 1000000, hidden: true, check: (user) => user.totalXP >= 1000000, getProgress: (user) => user.totalXP },
  { id: 'incinerator', title: 'Incinerator', description: 'Report progress and clear 15 pins', rarity: 'Legendary', reward: 6500, givesTitle: true, givesAsset: { id: 'pin_fire_shield', name: 'Fire Shield Pin', type: 'pin_design' }, target: 15, check: (user) => (user.clearedPinsCount || 0) >= 15, getProgress: (user) => user.clearedPinsCount || 0 },
  { id: 'leader_of_the_board', title: 'Leader of the Board', description: 'Finish #1 on the Leaderboard', rarity: 'Legendary', reward: 6500, givesTitle: true, target: 1, check: (user) => !!user.hasFinishedFirst, getProgress: (user) => user.hasFinishedFirst ? 1 : 0 },
  { id: 'mend_the_earth', title: 'Mend The Earth', description: 'Reach Level 15: Litter Legend', rarity: 'Legendary', reward: 6500, givesTitle: true, target: 725000, check: (user) => user.totalXP >= 725000, getProgress: (user) => user.totalXP },
  { id: 'tag_youre_it', title: "Tag, you're it!", description: 'Receive an official tag', rarity: 'Legendary', reward: 6500, target: 1, hidden: true, check: (user) => (user.tags || []).length > 0, getProgress: (user) => (user.tags || []).length >= 1 ? 1 : 0 },
  { id: 'organizer', title: 'Organizer', description: 'Organize 5 successful group cleanups with over 5 attendees', rarity: 'Legendary', reward: 6500, givesTitle: true, target: 5, check: (user) => (user.cleanupsOrganizedCount || 0) >= 5, getProgress: (user) => user.cleanupsOrganizedCount || 0 },
  { id: 'veteran', title: 'Veteran', description: 'Be a user of LitterLooker for 1 year', rarity: 'Legendary', reward: 6500, givesTitle: true, target: 1, check: (user) => { const oneYearMs = 365 * 24 * 60 * 60 * 1000; return (Date.now() - user.joinedAt) >= oneYearMs; }, getProgress: (user) => { const age = Date.now() - user.joinedAt; return age >= (365 * 24 * 60 * 60 * 1000) ? 1 : 0; } },
  { 
    id: 'primordial', 
    title: 'Primordial', 
    description: 'Be one of the first 100 users of LitterLooker', 
    rarity: 'Legendary', 
    reward: 6500, 
    givesTitle: true, 
    target: 1, 
    hidden: true, 
    check: (user, allUsers) => {
      const sortedUsers = Object.values(allUsers).sort((a, b) => a.joinedAt - b.joinedAt);
      const index = sortedUsers.findIndex(u => u.id === user.id);
      return index !== -1 && index < 100;
    },
    getProgress: (user, allUsers) => {
      const sortedUsers = Object.values(allUsers).sort((a, b) => a.joinedAt - b.joinedAt);
      const index = sortedUsers.findIndex(u => u.id === user.id);
      return (index !== -1 && index < 100) ? 1 : 0;
    }
  },
  { 
    id: 'litter_police', 
    title: 'Litter Police', 
    description: 'Warn a user as a Moderator', 
    rarity: 'Legendary', 
    reward: 6500, 
    givesTitle: true, 
    target: 1, 
    hidden: true, 
    check: (user) => (user.warningsSentCount || 0) >= 1, 
    getProgress: (user) => user.warningsSentCount || 0 
  },
  { 
    id: 'superior', 
    title: 'Superior', 
    description: 'Collect every achievement', 
    rarity: 'Legendary', 
    reward: 6500, 
    givesTitle: true, 
    target: 1, 
    hidden: true, 
    check: (user, allUsers) => {
      const otherAchievements = ACHIEVEMENTS_DATA.filter(a => a.id !== 'superior' && !a.hidden);
      return otherAchievements.every(a => a.check(user, allUsers));
    }, 
    getProgress: (user, allUsers) => {
      const otherAchievements = ACHIEVEMENTS_DATA.filter(a => a.id !== 'superior' && !a.hidden);
      const completed = otherAchievements.filter(a => a.check(user, allUsers)).length;
      return completed === otherAchievements.length ? 1 : 0;
    }
  },
  { 
    id: 'immaculate', 
    title: 'The Immaculate', 
    description: 'Achieve a daily challenge streak of 100', 
    rarity: 'Legendary', 
    reward: 6500, 
    givesTitle: true, 
    target: 100, 
    check: (user) => (user.dailyStreak || 0) >= 100, 
    getProgress: (user) => user.dailyStreak || 0 
  }
];

export interface DailyQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export const DAILY_QUESTIONS: DailyQuestion[] = EXTENDED_DAILY_QUESTIONS;

export const CREW_CHARACTERISTICS = [
  'Fun', 'Active', 'Creative', 'Dedicated', 'Eco-Friendly', 'Social', 'Competitive', 'Relaxed', 
  'Hardworking', 'Efficient', 'Helpful', 'Friendly', 'Ambitious', 'Organized', 'Passionate', 
  'Reliable', 'Energetic', 'Innovative', 'Collaborative', 'Supportive', 'Adventurous', 
  'Knowledgeable', 'Resourceful', 'Determined', 'Enthusiastic', 'Motivated', 'Disciplined', 
  'Patient', 'Kind', 'Respectful', 'Honest', 'Brave', 'Curious', 'Optimistic', 'Calm', 
  'Focused', 'Strategic', 'Analytical', 'Artistic', 'Musical', 'Technical', 'Scientific', 
  'Global', 'Local', 'Urban', 'Rural', 'Coastal', 'Mountain', 'Forest', 'Desert'
];

export const COMPETITION_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', 
  '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#14b8a6'
];

export const isRestrictedName = (name: string): boolean => {
  const lowerName = name.toLowerCase().trim();
  const levelNames = RANK_SYSTEM.map(r => r.name.toLowerCase());
  const achievementTitles = ACHIEVEMENTS_DATA.map(a => a.title.toLowerCase());
  const titleNames = Object.keys(TITLE_RARITY_MAP).map(t => t.toLowerCase());
  
  return levelNames.includes(lowerName) || 
         achievementTitles.includes(lowerName) || 
         titleNames.includes(lowerName);
};

export const EDUCATIONAL_TRIVIA_TIPS = [
  "A simple plastic bottle can take up to 450 years to fully decompose in nature.",
  "Despite being small, cigarette butts are the most littered item across the entire world.",
  "Unlike plastics, aluminum is unique because it can be recycled endlessly without any loss of quality.",
  "Sadly, more than 100,000 marine animals die every single year due to plastic pollution in their habitats.",
  "A single glass bottle takes about one million years to break down naturally.",
  "Globally, humanity consumes an astonishing one trillion plastic bags every single year.",
  "It takes about 80 to 200 years for an ordinary aluminum beverage can to decompose.",
  "Recent scientific studies estimate that up to 90% of all seabirds have swallowed plastic waste.",
  "Glass is one of the few materials that can be recycled endlessly with zero degradation in strength.",
  "Sea turtles often mistake floating plastic bags for jellyfish, which are their natural prey.",
  "On average, a person in the United States produces about 4.9 pounds of waste every day.",
  "Recycling one aluminum can saves enough energy to run a TV for about three hours!",
  "Littering costs cities and businesses billions of dollars annually in cleanup efforts.",
  "Over 80% of ocean plastic is estimated to originate from land-based sources."
];
