import { UrgencyLevel, UserProfile } from './types';
export { RANK_SYSTEM, INFINITY_XP, INFINITY_SYMBOL } from './constants';
import { RANK_SYSTEM, INFINITY_XP, INFINITY_SYMBOL } from './constants';

export const calculateCredibilityScore = (user: UserProfile, totalUserCount: number, allUsers: Record<string, UserProfile>): string | number => {
  const hasAdminTag = user.tags?.some(t => t.toLowerCase() === 'creator' || t.toLowerCase() === 'moderator');
  if (user.permissions?.isCreator || user.permissions?.isModerator || user.isAdmin || hasAdminTag) return 100;
  if (user.totalXP === INFINITY_XP) return "No score yet";

  const upvotedBy = user.upvotedBy || [];
  const downvotedBy = user.downvotedBy || [];
  const totalVotes = upvotedBy.length + downvotedBy.length;
  const dataPoints = totalVotes + (user.pinsSubmittedCount || 0) + (user.clearedPinsCount || 0);

  if (dataPoints < 5) {
    return "No score yet";
  }

  // Base score 50
  let score = 50;

  // Vote contribution
  // Influence = (users that voted on this profile / total user count) * 30
  const influence = totalUserCount > 0 ? (totalVotes / totalUserCount) * 30 : 0;
  
  // Calculate weighted votes
  let weightedUpvotes = 0;
  let weightedDownvotes = 0;

  const getWeight = (userId: string) => {
    const voter = allUsers[userId];
    if (voter && (voter.permissions?.isVerified || voter.permissions?.isModerator || voter.isAdmin)) {
      return 3;
    }
    return 1;
  };

  upvotedBy.forEach(id => weightedUpvotes += getWeight(id));
  downvotedBy.forEach(id => weightedDownvotes += getWeight(id));
  
  const totalWeightedVotes = weightedUpvotes + weightedDownvotes;

  if (totalWeightedVotes > 0) {
    const voteRatio = weightedUpvotes / totalWeightedVotes;
    // Map ratio 0-1 to -influence to +influence
    const voteContribution = (voteRatio * 2 * influence) - influence;
    score += voteContribution;
  }

  // Quality contribution (resolved pins)
  const submitted = user.pinsSubmittedCount || 1;
  const resolved = user.clearedPinsCount || 0;
  const resolvedRatio = resolved / Math.max(submitted, 1);
  // Map ratio 0-1 to 0 to +20
  score += (resolvedRatio * 20);

  return Math.max(1, Math.min(100, Math.round(score)));
};

export const calculatePinCredibilityScore = (pin: any, allUsers: Record<string, UserProfile>): string | number => {
  const creator = allUsers[pin.username] || allUsers[pin.userId];
  const hasAdminTag = creator?.tags?.some(t => t.toLowerCase() === 'creator' || t.toLowerCase() === 'moderator');
  if (creator && (creator.permissions?.isCreator || creator.permissions?.isModerator || creator.isAdmin || hasAdminTag)) return 100;

  const upvotes = pin.upvotes || [];
  const downvotes = pin.downvotes || [];
  const totalVotes = upvotes.length + downvotes.length;

  if (totalVotes < 2) {
    return "No score yet";
  }

  let weightedUpvotes = 0;
  let weightedDownvotes = 0;

  const getWeight = (userId: string) => {
    const voter = allUsers[userId];
    if (voter && (voter.permissions?.isVerified || voter.permissions?.isModerator || voter.isAdmin)) {
      return 3;
    }
    return 1;
  };

  upvotes.forEach((id: string) => weightedUpvotes += getWeight(id));
  downvotes.forEach((id: string) => weightedDownvotes += getWeight(id));

  let score = 50;
  const totalWeightedVotes = weightedUpvotes + weightedDownvotes;
  if (totalWeightedVotes > 0) {
    const voteRatio = weightedUpvotes / totalWeightedVotes;
    const voteContribution = (voteRatio * 100) - 50;
    score += voteContribution;
  }

  return Math.max(1, Math.min(100, Math.round(score)));
};

export const getUrgencyHexColor = (urgency?: UrgencyLevel) => {
  switch (urgency) {
    case 'extreme': return '#ef4444';
    case 'moderate': return '#f59e0b';
    case 'light': return '#10b981';
    default: return '#94a3b8';
  }
};

export const getMultiplierColor = (multiplier: number) => {
  if (multiplier >= 8) return '#ef4444';
  if (multiplier >= 5) return '#f59e0b';
  return '#22c55e';
};

export const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatFullTimestamp = (timestamp: number) => {
  return new Date(timestamp).toLocaleString([], { 
    year: 'numeric', 
    month: 'numeric', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

export const encrypt = (data: string) => { 
  try { return btoa(encodeURIComponent(data)); } catch (e) { return btoa(data); } 
};

export const decrypt = (data: string) => { 
  try { return decodeURIComponent(atob(data)); } catch (e) { return atob(data); } 
};

export const hashPassword = async (text: string) => { 
  const msgBuffer = new TextEncoder().encode(text); 
  const hashArray = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', msgBuffer))); 
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); 
};

export const getRankIconPath = (rankName: string) => {
  const normalizedName = rankName === 'Litter Looker' ? 'LitterLooker' : rankName === 'Terra Master' ? 'Terramaster' : rankName;
  return `/Graphics/Level-Icons/LitterLooker - ${normalizedName} Rank Icon.png`;
};

export const preloadRankIcons = () => {
  if (typeof window === 'undefined') return;
  RANK_SYSTEM.forEach(rank => {
    const img = new Image();
    img.src = getRankIconPath(rank.name);
  });
};

// Immediately kick off preloading when utils module is loaded
if (typeof window !== 'undefined') {
  try {
    preloadRankIcons();
  } catch (e) {
    // ignore SSG/SSR errors
  }
}

export const getRankInfo = (xp: number) => {
  if (xp === INFINITY_XP) return RANK_SYSTEM[RANK_SYSTEM.length - 1]; // Infinity XP: Max Rank
  let currentRank = RANK_SYSTEM[0];
  for (let i = RANK_SYSTEM.length - 1; i >= 0; i--) {
    if (xp >= RANK_SYSTEM[i].threshold) {
      currentRank = RANK_SYSTEM[i];
      break;
    }
  }
  return currentRank;
};

/**
 * Recursively removes undefined values from an object or array.
 * Firestore does not support undefined values.
 */
export const sanitizeData = (data: any): any => {
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }
  const sanitized: any = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];
      if (value !== undefined) {
        sanitized[key] = sanitizeData(value);
      }
    }
  }
  return sanitized;
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
};

/**
 * Compresses an image to a maximum dimension and quality.
 * Useful for mobile uploads to avoid exceeding API limits.
 */
export const compressImage = (base64Str: string, maxWidth = 1024, maxHeight = 1024, quality = 0.7, forceSquare = false): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      // Preserve transparency for PNGs or forceSquare. For JPEG outputs, fill canvas with white instead of black.
      const isPng = forceSquare || base64Str.startsWith('data:image/png') || base64Str.startsWith('data:image/svg');

      if (forceSquare) {
        const size = Math.min(width, height);
        const offsetX = (width - size) / 2;
        const offsetY = (height - size) / 2;
        
        canvas.width = Math.min(size, maxWidth);
        canvas.height = Math.min(size, maxHeight);
        
        if (!isPng) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, canvas.width, canvas.height);
      } else {
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        if (!isPng) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

export const recordDailyScrap = (u: any, amount: number, skipMonthly: boolean = false) => {
  const isInfinity = u.totalXP === INFINITY_XP;
  const today = getLocalDateString();
  const dailyEarnings = { ...(u.dailyEarnings || {}) };
  dailyEarnings[today] = (dailyEarnings[today] || 0) + amount;
  
  // 1 Scrap for every 100 XP earned
  // We should track lifetime XP to avoid "lossy" rounding on small batches
  const oldXP = u.totalXP || 0;
  const newXP = isInfinity ? oldXP : oldXP + amount;
  const scrapToEarn = isInfinity ? 0 : (Math.floor(newXP / 100) - Math.floor(oldXP / 100));

  return { 
    ...u, 
    totalXP: isInfinity ? INFINITY_XP : newXP, 
    availableXP: (u.availableXP || 0) + amount, 
    availableScrap: isInfinity ? INFINITY_XP : (u.availableScrap || 0) + scrapToEarn,
    monthlyXP: (u.monthlyXP || 0) + (skipMonthly ? 0 : amount), 
    dailyEarnings 
  };
};

export const convertWeight = (kg: number, system: 'metric' | 'imperial' = 'metric') => {
  if (system === 'imperial') {
    return kg * 2.20462;
  }
  return kg;
};

export const convertArea = (m2: number, system: 'metric' | 'imperial' = 'metric') => {
  if (system === 'imperial') {
    return m2 * 10.7639;
  }
  return m2;
};

export const getWeightUnit = (system: 'metric' | 'imperial' = 'metric') => {
  return system === 'imperial' ? 'lbs' : 'kg';
};

export const getAreaUnit = (system: 'metric' | 'imperial' = 'metric') => {
  return system === 'imperial' ? 'sq ft' : 'm²';
};

import { useState, useEffect } from 'react';

export const useIsDarkMode = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => {
      mediaQuery.removeEventListener('change', listener);
    };
  }, []);

  return isDark;
};

export const getUserFullName = (user?: Partial<UserProfile> | null): string => {
  if (!user) return 'User';
  if (user.firstName && user.lastName) {
    return `${user.firstName.trim()} ${user.lastName.trim()}`;
  }
  if (user.firstName && user.firstName.trim()) {
    return user.firstName.trim();
  }
  if (user.username && user.username.trim()) {
    return user.username.trim();
  }
  return 'User';
};

export const getUserFirstName = (user?: Partial<UserProfile> | null): string => {
  if (!user) return 'User';
  if (user.firstName && user.firstName.trim()) {
    return user.firstName.trim();
  }
  if (user.username && user.username.trim()) {
    const parts = user.username.trim().split(/\s+/);
    return parts[0] || 'User';
  }
  return 'User';
};

export const isHandleTaken = async (
  db: any,
  targetHandle: string,
  currentUserId?: string,
  currentUid?: string
): Promise<boolean> => {
  const cleanTarget = targetHandle.trim().toLowerCase();
  if (!cleanTarget) return false;

  try {
    const { collection, getDocs, doc, getDoc } = await import('firebase/firestore');

    // 1. Check direct doc lookup by target handle
    const directDoc = await getDoc(doc(db, "users", targetHandle.trim()));
    if (directDoc.exists()) {
      const data = directDoc.data();
      const matchDocId = directDoc.id;
      const matchUserId = data?.id || matchDocId;
      const matchUid = data?.uid;

      const isCurrent = (currentUserId && (matchDocId === currentUserId || matchUserId === currentUserId)) ||
                        (currentUid && matchUid === currentUid);
      if (!isCurrent) {
        return true;
      }
    }

    // 2. Query users collection for case-insensitive username or doc ID matches
    const usersSnap = await getDocs(collection(db, "users"));
    for (const uDoc of usersSnap.docs) {
      const uData = uDoc.data() || {};
      const uDocId = uDoc.id;
      const uUserId = uData.id || uDocId;
      const uUid = uData.uid;

      const isCurrent = (currentUserId && (uDocId === currentUserId || uUserId === currentUserId)) ||
                        (currentUid && uUid === currentUid);
      if (isCurrent) continue;

      const uUsername = (uData.username || uDocId || '').trim().toLowerCase();
      if (uUsername === cleanTarget || uDocId.trim().toLowerCase() === cleanTarget) {
        return true;
      }
    }
  } catch (err) {
    console.error("Error checking handle uniqueness:", err);
  }

  return false;
};

export const migrateUserDatabaseStructure = async (db: any, onProgress?: (msg: string) => void): Promise<{ success: boolean; count: number }> => {
  try {
    const { collection, getDocs, doc, setDoc } = await import('firebase/firestore');
    const usersSnap = await getDocs(collection(db, 'users'));
    let updatedCount = 0;

    for (const docSnap of usersSnap.docs) {
      const data = docSnap.data() || {};
      const docId = docSnap.id;

      // Extract existing name components or derive from username
      let firstName = (data.firstName || '').trim();
      let lastName = (data.lastName || '').trim();
      let rawUsername = (data.username || docId || '').trim();

      // If missing firstName or lastName, infer them from rawUsername
      if (!firstName || !lastName) {
        if (rawUsername.includes(' ')) {
          const parts = rawUsername.split(/\s+/);
          if (!firstName) firstName = parts[0] || 'User';
          if (!lastName) lastName = parts.slice(1).join(' ') || 'Member';
        } else {
          if (!firstName) firstName = rawUsername || 'User';
          if (!lastName) lastName = 'Member';
        }
      }

      // Format clean username handle (lowercased without spaces or invalid chars if was multi-word)
      let cleanUsername = rawUsername;
      if (cleanUsername.includes(' ')) {
        cleanUsername = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9_]/g, '');
      }
      if (!cleanUsername) {
        cleanUsername = docId;
      }

      const structuredProfile = sanitizeData({
        ...data,
        id: docId,
        uid: data.uid || docId,
        username: cleanUsername,
        firstName,
        lastName,
        totalXP: typeof data.totalXP === 'number' ? data.totalXP : 0,
        availableXP: typeof data.availableXP === 'number' ? data.availableXP : 0,
        availableScrap: typeof data.availableScrap === 'number' ? data.availableScrap : 0,
        dailyXP: typeof data.dailyXP === 'number' ? data.dailyXP : 0,
        monthlyXP: typeof data.monthlyXP === 'number' ? data.monthlyXP : 0,
        sparks: typeof data.sparks === 'number' ? data.sparks : 0,
        joinedAt: data.joinedAt || Date.now(),
        loginCount: typeof data.loginCount === 'number' ? data.loginCount : 1,
        appOpenCount: typeof data.appOpenCount === 'number' ? data.appOpenCount : 1,
        permissions: {
          isVerified: Boolean(data.permissions?.isVerified),
          isCreator: Boolean(data.permissions?.isCreator),
          isTester: Boolean(data.permissions?.isTester),
          isModerator: Boolean(data.permissions?.isModerator),
        },
        completedAchievements: Array.isArray(data.completedAchievements) ? data.completedAchievements : [],
        earnedTitles: Array.isArray(data.earnedTitles) ? data.earnedTitles : [],
        tags: Array.isArray(data.tags) ? data.tags : [],
        dailyEarnings: data.dailyEarnings || {},
        friends: Array.isArray(data.friends) ? data.friends : [],
        friendRequests: Array.isArray(data.friendRequests) ? data.friendRequests : [],
        unlockedAssets: Array.isArray(data.unlockedAssets) ? data.unlockedAssets : [],
        audioEnabled: data.audioEnabled !== false,
        audioVolume: typeof data.audioVolume === 'number' ? data.audioVolume : 0.5,
        updatedAt: Date.now()
      });

      try {
        await setDoc(doc(db, 'users', docId), structuredProfile, { merge: true });
        updatedCount++;
        if (onProgress) onProgress(`Migrated ${updatedCount}/${usersSnap.size} user profiles...`);
      } catch (docErr) {
        console.warn(`Could not migrate user doc ${docId}:`, docErr);
      }
    }

    console.log(`Database Migration Complete: Updated ${updatedCount} user documents to organized structure.`);
    return { success: true, count: updatedCount };
  } catch (err) {
    console.warn('User database structure migration skipped or failed:', err);
    return { success: false, count: 0 };
  }
};

