export interface LitterStats {
  weightKg: number;
  areaSqM: number;
  piecesCount: number;
}

export interface GlobalSettings {
  id: string;
  showPublicStats: boolean;
  disableDailyChallenges?: boolean;
  totalLitterStats: LitterStats;
  totalLitterStatsHistory?: (LitterStats & { timestamp: number })[];
}

export interface LeaderboardReward {
  rank: number;
  reward: number;
  monthName: string;
}

export interface FriendRequest {
  fromUserId: string;
  fromUsername: string;
  timestamp: number;
}

export interface AdminLog {
  id: string;
  adminId: string;
  adminUsername: string;
  action: string;
  details: string;
  timestamp: number;
}

export interface BlockEvent {
  type: 'warning' | 'day' | 'week' | 'ban';
  timestamp: number;
  reason: string;
}

export interface CrewInvite {
  teamId: string;
  teamName: string;
  teamIcon?: string;
  teamBgColor?: string;
  fromUsername: string;
  timestamp: number;
}

export interface UserProfile {
  id: string; // This will be the username (Document ID)
  uid?: string; // Firebase Auth UID for mapping
  username: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  totalXP: number; // Cumulative, never decreases
  availableXP: number; // Spendable XP balance (deprecated for shop but kept for compatibility)
  availableScrap: number; // NEW separate currency for shop
  dailyXP: number; // Added daily XP
  monthlyXP?: number;
  lastResetMonth?: string;
  lastLoginDate?: string;
  joinedAt: number;
  isAdmin?: boolean;
  
  // Sanction System
  banLevel?: number; // 0: None, 1: Warned, 2: Day, 3: Week, 4: Perm
  blockHistory?: BlockEvent[];
  blockedUntil?: number;
  blockReason?: string;
  warningCount?: number;
  lastWarningAt?: number;
  lastViolationAt?: number; // Tracking the 1-year escalation window
  totalWarningsReceived?: number;
  
  // Protected Tags
  permissions?: {
    isVerified?: boolean; 
    isCreator?: boolean;  
    isTester?: boolean;
    isModerator?: boolean;
  };

  appOpenCount?: number;
  hasSeenTutorial?: boolean;
  tutorialStep?: number;
  leaderboardId?: string;
  nextLeaderboardId?: string | null;
  pendingLeaderboardReward?: LeaderboardReward | null;

  profilePicture?: string;
  clearedPinsCount?: number;
  pinsSubmittedCount?: number;
  postsCount?: number;
  linkedPostsCount?: number;
  commentsCount?: number;
  timesTaggedCount?: number;
  maxLikesReceived?: number;
  maxCommentsReceived?: number;
  totalUsersTaggedCount?: number;
  completedAchievements?: string[];
  earnedTitles?: string[];
  selectedTitle?: string;
  tags?: string[];
  hasFinishedFirst?: boolean;
  usernameChangeCount?: number;
  lastHandleChangeLevel?: number;
  profilePictureChangeCount?: number;
  loginCount?: number;
  hasBeenTagged?: boolean;
  totalReactionsReceived?: number;
  totalUpvotesReceived?: number;
  totalDownvotesReceived?: number;
  credibilityScore?: number;
  upvotedBy?: string[];
  downvotedBy?: string[];
  dailyEarnings?: Record<string, number>; 
  maxMissedCount?: number; 
  multiplierReportsCount?: number;
  daily5000XPCount?: number;
  teamId?: string;
  teamName?: string;
  teamRole?: 'member' | 'admin' | 'creator';
  
  // Customization
  unlockedAssets?: string[];
  selectedProfileBorder?: string;
  selectedPostBorder?: string;
  selectedPinDesign?: string;
  
  // Username Customization
  usernameColor?: string; 
  usernameGradient?: [string, string]; 
  usernameShine?: boolean; 

  // Daily action tracking
  lastActionDate?: string; 
  dailyPostsCount?: number;
  dailyPinsCount?: number;
  dailyCommentsCount?: number;
  dailyGroupCleanupsCount?: number;
  cleanupsOrganizedCount?: number;
  highEfficiencyParticipationsCount?: number;
  lastReportAt?: number; // Added for cooldown management
  lastPinAt?: number; // Added for pin placement cooldown
  warningsSentCount?: number;
  lastSeenWarningCount?: number;
  hasInvitedFriend?: boolean;
  litterStats?: LitterStats;
  litterStatsHistory?: (LitterStats & { timestamp: number })[];

  // Social
  friends?: string[]; 
  friendRequests?: FriendRequest[];
  crewInvites?: CrewInvite[];
  description?: string; // Max 30 words
  visibility?: 'active' | 'inactive';
  publicProfileSettings?: {
    showTotalXP?: boolean;
    showAchievements?: boolean;
    showRank?: boolean;
    showBuddies?: boolean;
  };
  pushNotificationSettings?: {
    friendInvites?: boolean;
    teamMessages?: boolean;
    teamEvents?: boolean;
    leaderboardUpdates?: boolean;
    mentions?: boolean;
  };
  allowFriendRequests?: boolean;
  resetAccount?: boolean;
  lastActiveAt?: number;
  blockedUsers?: string[];
  notifications?: { id: string, message: string, timestamp: number, read: boolean }[];
  dailyStreak?: number;
  lastDailyAnsweredDate?: string;
  lastDailyAnsweredOption?: number;
  isStreakSavedBySpark?: boolean; // Indicates if current streak was saved by a spark (vulnerable)
  streakSavedDate?: string;
  sparks: number; // Added sparks
  unseenSparksUsed?: number;
  lastSparkSavedNotificationDate?: string;
  measurementSystem?: 'metric' | 'imperial';
  lowPowerModeEnabled?: boolean;
  audioEnabled: boolean;
  audioVolume: number; // 0 to 1
  bgMusicEnabled?: boolean;
  bgMusicVolume?: number; // 0 to 1
  mapRadiusFilter?: number; // 2 to 100 miles
  lat?: number;
  lng?: number;
  
  // Global Rankings
  globalRank_weight?: number;
  globalRank_area?: number;
  globalRank_pieces?: number;
  
  // Daily Challenge State
  currentChallengeReward?: number;
  currentChallengeQuestionsAnswered?: number;
  hasEndedChallengeToday?: boolean;
  currentChallengeHistory?: { questionIndex: number, selectedOption: number, correct: boolean }[];
  currentChallengeTimeLeft?: number;
  fcmToken?: string;
  purchaseCounts?: Record<string, number>; // itemId -> count
}

export interface Team {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorUsername: string;
  members: string[]; // List of usernames
  admins: string[]; // List of usernames
  memberUids?: string[]; // List of UIDs
  adminUids?: string[]; // List of UIDs
  joinedAt: number;
  logoUrl?: string;
  bannerUrl?: string;
  isPrivate: boolean;
  joinRequests?: string[]; // List of usernames
  
  // New fields
  maxSize: number;
  characteristics: string[];
  region?: string;
  lat?: number;
  lng?: number;
  icon?: string;
  backgroundColor?: string;
  minXp?: number;
  litterStats?: LitterStats;
  litterStatsHistory?: (LitterStats & { timestamp: number })[];
  shardId?: string;
  capturedPercentage?: number;
  competitionColor?: string;
  totalArea: number;
  dailyArea: number;
}

export interface TeamMessage {
  id: string;
  teamId: string;
  userId: string;
  username: string;
  userProfilePicture?: string;
  content: string;
  timestamp: number;
  imageUrl?: string;
  taggedUsernames?: string[];
  linkedPinId?: string;
  isSystem?: boolean;
}

export interface ContentReport {
  id: string;
  reporterId: string;
  reporterUsername: string;
  targetId: string; // Pin ID or Post ID
  targetType: 'pin' | 'post' | 'user';
  reason: string;
  timestamp: number;
  status: 'pending' | 'reviewed' | 'resolved';
  resolvedAt?: number;
}

export interface ProgressReport {
  id: string;
  userId: string;
  username: string;
  userProfilePicture?: string;
  description: string;
  mediaUrl: string;
  mediaUrls?: string[];
  mediaType: 'image' | 'video';
  timestamp: number;
  percentage?: number;
  taggedUsernames?: string[];
  litterStats?: LitterStats;
}

export type UrgencyLevel = 'extreme' | 'moderate' | 'light';

export interface MapPin {
  id: string; // Format: username_timestamp
  userId: string;
  username: string;
  description: string;
  lat: number;
  lng: number;
  timestamp: number;
  status: 'pending' | 'cleaned';
  progressReports?: ProgressReport[];
  imageUrl?: string;
  mediaUrls?: string[];
  urgency?: UrgencyLevel;
  intensity?: number; // 0-100%
  design?: string; 
  upvotes?: string[];
  downvotes?: string[];
  verified?: boolean;
  reportCount?: number;
}

export interface Reply {
  id: string;
  userId: string;
  username: string;
  userProfilePicture?: string;
  content: string;
  timestamp: number;
}

export interface CommunityPost {
  id: string; // Format: username_timestamp
  userId: string;
  username: string;
  userProfilePicture?: string;
  content: string;
  timestamp: number;
  imageUrl?: string;
  linkedPinId?: string;
  reactions: Record<string, string[]>; 
  replies: Reply[];
  taggedUsernames?: string[];
  borderStyle?: string; 
  reportCount?: number;
  lat?: number;
  lng?: number;
}

export interface Announcement {
  id: string;
  content: string;
  timestamp: number;
  imageUrl?: string;
  image?: string;
  mediaType?: 'image' | 'video';
  linkedPinId?: string;
  taggedUsernames?: string[];
  reactions: Record<string, string[]>;
  replies: Reply[];
  allowComments?: boolean; 
  allowReactions?: boolean; 
  offerFreeSpark?: boolean;
  sparkClaimers?: string[];
}

export interface MultiplierZone {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  multiplier: number;
  title?: string;
  address?: string;
  timestamp: number;
  description?: string;
  startTime?: number;
  endTime?: number;
}

export interface CleanupAttendee {
  username: string;
  efficiency: number; // 0 to 1
  rewardScrap: number;
}

export interface GroupCleanup {
  id: string;
  userId: string;
  username: string;
  creatorId: string;
  creatorUsername: string;
  title?: string;
  description?: string;
  lat: number;
  lng: number;
  address?: string;
  startTime: number;
  endTime: number;
  invitedUsernames: string[];
  participatorUsernames: string[];
  maxParticipants?: number;
  attendees?: CleanupAttendee[];
  isCompleted?: boolean;
  completedAt?: number;
  isPrivate?: boolean;
  teamId?: string; // If associated with a crew
  timestamp: number;
  organizerRatings?: {
    userId: string;
    username: string;
    rating: number;
    comment?: string;
    timestamp: number;
  }[];
}

export interface UserReport {
  id: string;
  reporterId: string;
  reporterUid: string;
  reporterUsername: string;
  targetUserId: string;
  targetUsername: string;
  reason: string;
  timestamp: number;
  status: 'pending' | 'reviewed' | 'resolved';
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  priceScrap: number;
  imageUrls: string[];
  type: 'spark' | 'title' | 'product';
  maxPurchase?: number; // per user
  launchDate?: number;
  endDate?: number;
  rarity?: 'Common' | 'Rare' | 'Legendary';
  disabled?: boolean;
  metadata?: Record<string, any>;
  createdAt: number;
}

export type TabType = 'home' | 'map' | 'leaderboard' | 'community' | 'profile' | 'achievements' | 'friends' | 'rewards' | 'admin' | 'crews' | 'world_rankings';
