import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LogOut, User, ShieldCheck, ShieldAlert, Clock, Ban, AlertCircle, Loader2, Zap, Users, Trophy, MapPin as MapPinIcon, Medal } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ErrorScreen } from './components/ErrorScreen';
import { UserProfile, MapPin, CommunityPost, TabType, Announcement, ProgressReport, UrgencyLevel, Reply, FriendRequest, MultiplierZone, BlockEvent, GroupCleanup, UserReport, GlobalSettings, LitterStats, Team } from './types';
import { estimateLitterStats } from './services/gemini';
import { getRankInfo, getRankIconPath, getLocalDateString, sanitizeData, calculateDistance, recordDailyScrap, isHandleTaken } from './utils';
import { ICONS, RANK_SYSTEM, ACHIEVEMENTS_DATA, DAILY_QUESTIONS, INFINITY_XP } from './constants';

import { AuthScreen } from './components/AuthScreen';
import { BackgroundBlobs } from './components/BackgroundBlobs';
import { HomePage } from './components/HomePage';
import { MapPage } from './components/MapPage';
import { LeaderboardPage } from './components/LeaderboardPage';
import { CommunityPage } from './components/CommunityPage';
import { ProfilePage } from './components/ProfilePage';
import { AchievementsPage } from './components/AchievementsPage';
import { CleanupCrewsPage } from './components/CleanupCrewsPage';
import { RewardsPage } from './components/RewardsPage';
import { VerifiedBadge } from './components/VerifiedBadge';
import { NotificationToast } from './components/NotificationToast';
import { ScrapGainBox } from './components/ScrapGainBox';
import { LevelUpOverlay } from './components/LevelUpOverlay';
import { RankPathModal } from './components/RankPathModal';
import { ViewProfileModal } from './components/ViewProfileModal';
import { Username } from './components/Username';
import { TitleDisplay } from './components/TitleDisplay';
import { AdminDashboard } from './components/AdminDashboard';
import { ConfirmModal } from './components/ConfirmModal';
import { TermsModal } from './components/TermsModal';
import { processDailyRewards, processMonthlyReset, processGlobalLeaderboards, cleanupOldReports } from './services/dailyTaskService';

import { WorldRankingsPage } from './components/WorldRankingsPage';
import { ResumeTutorialBar } from './components/ResumeTutorialBar';
import { TutorialOverlay } from './components/TutorialOverlay';
import { BlockedScreen } from './components/BlockedScreen';
import { LockdownScreen } from './components/LockdownScreen';
import { LoadingAuth } from './components/LoadingAuth';
import { EmailVerificationScreen } from './components/EmailVerificationScreen';
import { audioService } from './services/audioService';

// Firebase Imports
import { db, auth, OperationType, handleFirestoreError, requestNotificationPermission, messaging } from './services/firebase';
import { onMessage } from 'firebase/messaging';
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, updateDoc, query, where, getDocs, limit, Unsubscribe, arrayUnion, arrayRemove, writeBatch, increment, deleteField, runTransaction } from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  browserPopupRedirectResolver
} from 'firebase/auth';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(true);
  const [rawActiveTab, setRawActiveTab] = useState<TabType>('home');
  const [loadedFeatures, setLoadedFeatures] = useState<Record<string, boolean>>({ home: true });
  const [loadingFeature, setLoadingFeature] = useState<string | null>(null);

  const setActiveTab = useCallback((tab: TabType) => {
    if (tab === rawActiveTab) return;
    
      const featureNames: Record<string, string> = {
        map: 'Map Page',
        leaderboard: 'Leaderboard Page',
        achievements: 'Achievements Page',
        profile: 'Profile Page',
        world_rankings: 'World Rankings Page',
        community: 'Community Page',
        crews: 'Cleanup Crews Page',
        rewards: 'Rewards Page',
        admin: 'Admin Page'
      };

    if (tab !== 'home' && !loadedFeatures[tab] && featureNames[tab]) {
      setLoadingFeature(featureNames[tab]);
      setTimeout(() => {
        setLoadedFeatures(prev => ({ ...prev, [tab]: true }));
        setRawActiveTab(tab);
        setLoadingFeature(null);
      }, 1000);
    } else {
      setRawActiveTab(tab);
    }
  }, [rawActiveTab, loadedFeatures]);

  const activeTab = rawActiveTab;
  const [pins, setPins] = useState<MapPin[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [groupCleanups, setGroupCleanups] = useState<GroupCleanup[]>([]);
  const [zones, setZones] = useState<MultiplierZone[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [allUsers, setAllUsers] = useState<Record<string, UserProfile>>({});
  const [focusPinId, setFocusPinId] = useState<string | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [scrapGain, setScrapGain] = useState<number | null>(null);
  const [viewingRankPathUser, setViewingRankPathUser] = useState<UserProfile | null>(null);
  const [lastSeen, setLastSeen] = useState<number>(Date.now());
  const [dismissedMissedIds, setDismissedMissedIds] = useState<string[]>([]);
  const [isLockedDown, setIsLockedDown] = useState<boolean>(false);
  const [lockdownReason, setLockdownReason] = useState<string>('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [features, setFeatures] = useState<Record<string, string>>({
    pins: 'disabled',
    scheduling: 'disabled',
    ai: 'disabled',
    community: 'disabled',
    crews: 'disabled',
    shop: 'disabled',
    daily: 'disabled',
    leaderboard: 'disabled',
  });
  
  useEffect(() => {
    if (user?.lowPowerModeEnabled) {
      document.body.classList.add('low-power-mode');
    } else {
      document.body.classList.remove('low-power-mode');
    }
  }, [user?.lowPowerModeEnabled]);

  useEffect(() => {
    if (user) {
      audioService.setEnabled(user.audioEnabled !== false);
      audioService.setVolume(typeof user.audioVolume === 'number' ? user.audioVolume : 0.5);
      audioService.setBgMusicEnabled(user.bgMusicEnabled === true);
      audioService.setBgMusicVolume(typeof user.bgMusicVolume === 'number' ? user.bgMusicVolume : 0.3);
    } else {
      audioService.setEnabled(true);
      audioService.setVolume(0.5);
      audioService.setBgMusicEnabled(false);
      audioService.setBgMusicVolume(0.3);
    }
  }, [user?.audioEnabled, user?.audioVolume, user?.bgMusicEnabled, user?.bgMusicVolume]);

  // Preload rank icons when app starts to optimize level path screen load times
  useEffect(() => {
    RANK_SYSTEM.forEach((rank) => {
      const img = new Image();
      img.src = getRankIconPath(rank.name);
    });
  }, []);

  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [adminList, setAdminList] = useState<string[]>([]);
  const [levelUpRank, setLevelUpRank] = useState<any | null>(null);
  const [notificationQueue, setNotificationQueue] = useState<{message: string, type: 'success' | 'error' | 'warning' | 'info'}[]>([]);
  const [currentNotification, setCurrentNotification] = useState<{message: string, type: 'success' | 'error' | 'warning' | 'info'} | null>(null);
  const [lastResetMonth, setLastResetMonth] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [activeZone, setActiveZone] = useState<MultiplierZone | null>(null);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [isAdminPanelValid, setIsAdminPanelValid] = useState<boolean>(true);
  const [isModPanelValid, setIsModPanelValid] = useState<boolean>(true);
  const [criticalDataLoaded, setCriticalDataLoaded] = useState({ leaderboard: false, posts: false });
  const [appError, setAppError] = useState<string | null>(null);
  const [showWarningPopup, setShowWarningPopup] = useState(false);
  const [warningReason, setWarningReason] = useState('');
  const [lastWarningCount, setLastWarningCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Play sound effects reactively on major app events and state changes
  useEffect(() => {
    if (levelUpRank) {
      audioService.playLevelUp();
    }
  }, [levelUpRank]);

  useEffect(() => {
    if (scrapGain) {
      audioService.playSuccess();
    }
  }, [scrapGain]);

  useEffect(() => {
    if (showWarningPopup || isLockedDown) {
      audioService.playWarning();
    }
  }, [showWarningPopup, isLockedDown]);

  // We no longer manually set a global timeout error here.

  useEffect(() => {
    if (!authInitialized) return;
    if (!user) {
      setIsLoadingAuth(false);
      return;
    }
    
    // If critical data loads quickly, hide loader immediately
    if (criticalDataLoaded.leaderboard && criticalDataLoaded.posts) {
      setIsLoadingAuth(false);
    }
  }, [authInitialized, user, criticalDataLoaded]);

  const [loadingAttempt, setLoadingAttempt] = useState(1);

  // Fallback to ensure we retry and restart if loading gets stuck (e.g. Firebase offline)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoadingAuth) {
      if (loadingAttempt === 1) {
        timer = setTimeout(() => {
          console.warn("App taking too long to load, retrying...");
          setLoadingAttempt(2);
          setCriticalDataLoaded({ leaderboard: false, posts: false });
        }, 5000);
      } else if (loadingAttempt === 2) {
        timer = setTimeout(() => {
          console.error("App failed to load again, restarting...");
          window.location.reload();
        }, 5000);
      }
    }
    return () => clearTimeout(timer);
  }, [isLoadingAuth, loadingAttempt]);

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    // Suppress all success notifications as requested
    if (type === 'success') return;
    if (message.toLowerCase().includes('success') || message.toLowerCase().includes('granted') || message.toLowerCase().includes('access granted')) return;
    setNotificationQueue(prev => [...prev, { message, type }]);
  }, []);

  const syncPendingData = useCallback(async () => {
    try {
      const pendingStr = localStorage.getItem('pendingPins');
      let successCountPins = 0;
      if (pendingStr) {
        const pendingPins = JSON.parse(pendingStr);
        if (pendingPins.length > 0) {
          const stillPending = [];
          for (const pin of pendingPins) {
            try {
              // Ensure we don't try to sync the offline flag to db
              const pinToSave = { ...pin };
              delete pinToSave.isPendingOffline;
              await setDoc(doc(db, "pins", pin.id), sanitizeData(pinToSave));
              successCountPins++;
            } catch (err: any) {
              console.error("Failed to sync pending pin:", pin.id, err);
              // If it's a network error, keep it. Otherwise, drop it to avoid stuck queue.
              if (err.message?.includes('network') || err.message?.includes('offline')) {
                stillPending.push(pin);
              }
            }
          }
          if (stillPending.length === 0) {
            localStorage.removeItem('pendingPins');
          } else {
            localStorage.setItem('pendingPins', JSON.stringify(stillPending));
          }
          
          // Force UI to sync with the new pending list, to remove pins that failed non-network errors
          setPins((prev: any) => {
            const onlyDbPins = prev.filter((p: any) => !p.isPendingOffline);
            const merged = [...onlyDbPins, ...stillPending.map((p: any) => ({ ...p, isPendingOffline: true }))];
            return merged.sort((a, b) => b.timestamp - a.timestamp);
          });
        }
      }
      
      const pendingProgStr = localStorage.getItem('pendingProgress');
      let successCountProg = 0;
      if (pendingProgStr) {
        const pendingProgress = JSON.parse(pendingProgStr);
        if (pendingProgress.length > 0) {
          const stillPendingProg = [];
          for (const item of pendingProgress) {
            const { pid, r } = item;
            try {
              const reportToSave = { ...r };
              delete reportToSave.isPendingOffline;
              await setDoc(doc(db, "progressReports", r.id), { ...sanitizeData(reportToSave), pinId: pid });
              
              const pRef = doc(db, "pins", pid);
              const pSnap = await getDoc(pRef);
              if (pSnap.exists()) {
                const pData = pSnap.data();
                const updatedReports = sanitizeData([...(pData.progressReports || []), sanitizeData(reportToSave)]); 
                await updateDoc(pRef, { progressReports: updatedReports });
              }
              successCountProg++;
            } catch (err: any) {
              console.error("Failed to sync pending progress:", r.id, err);
              if (err.message?.includes('network') || err.message?.includes('offline')) {
                stillPendingProg.push(item);
              }
            }
          }
          if (stillPendingProg.length === 0) {
            localStorage.removeItem('pendingProgress');
          } else {
            localStorage.setItem('pendingProgress', JSON.stringify(stillPendingProg));
          }
          
          setPins((prev: any) => {
            return prev.map((p: any) => {
              const pendingForPin = stillPendingProg.filter((sp: any) => sp.pid === p.id);
              if (pendingForPin.length > 0) {
                const dbReports = (p.progressReports || []).filter((r: any) => !r.isPendingOffline);
                const updatedReports = [...dbReports, ...pendingForPin.map((sp: any) => ({ ...sp.r, isPendingOffline: true }))];
                return { ...p, progressReports: updatedReports };
              } else {
                return { ...p, progressReports: (p.progressReports || []).filter((r: any) => !r.isPendingOffline) };
              }
            });
          });
        }
      }

      if (successCountPins > 0 || successCountProg > 0) {
        setTimeout(() => {
          showNotification(`Synced ${successCountPins} pending pins and ${successCountProg} progress reports!`, "success");
        }, 500);
      }

    } catch (e) {
      console.error("Failed to sync pending items:", e);
    }
  }, [showNotification]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (authInitialized && auth.currentUser) {
        syncPendingData();
      }
    };
    const handleOffline = () => setIsOnline(false);

    const handleError = (event: ErrorEvent) => {
      console.error("Global error caught:", event.error);
      setAppError(event.message || "Unknown error");
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      const msg = event.reason instanceof Error ? event.reason.message : String(event.reason);
      setAppError(msg || "Unknown error");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    if (navigator.onLine && authInitialized && auth.currentUser) {
       syncPendingData();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [syncPendingData, authInitialized]);

  useEffect(() => {
    // Only fetch token if permission is already granted; do not prompt on mount
    if ("Notification" in window && Notification.permission === "granted") {
      requestNotificationPermission().catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (user && messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Message received. ', payload);
        if (payload.notification) {
          showNotification(payload.notification.title || 'New Notification', 'info');
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(payload.notification.title || 'LitterLooker', {
              body: payload.notification.body,
              icon: '/vite.svg'
            });
          }
        }
      });
      return () => unsubscribe();
    }
  }, [messaging, user?.id]);

  useEffect(() => {
    if (user) {
      requestNotificationPermission().then(token => {
        if (token && token !== user.fcmToken) {
          console.log('FCM Token:', token);
          handleUpdateUser({ ...user, fcmToken: token });
        }
      });
    }
  }, [user?.id]);

  useEffect(() => {
    if (user && globalSettings) {
      const today = getLocalDateString();
      const lastAnswered = user.lastDailyAnsweredDate || '';
      const lastLogin = user.lastLoginDate || '';
      const yesterday = getLocalDateString(new Date(Date.now() - 86400000));

      const updates: any = {};
      let needsUpdate = false;

      // Handle daily login tasks
      if (!lastLogin || lastLogin !== today) {
        updates.lastLoginDate = today;
        cleanupOldReports();
        needsUpdate = true;
      }

      // Reset daily challenge state for new day
      if (lastAnswered !== today && user.hasEndedChallengeToday) {
        updates.hasEndedChallengeToday = false;
        updates.currentChallengeReward = 0;
        updates.currentChallengeQuestionsAnswered = 0;
        updates.currentChallengeHistory = [];
        updates.currentChallengeTimeLeft = 60;
        needsUpdate = true;
      }

      // Recheck daily challenge streak every time the app loads in
      const isDailyEnabled = features.daily === 'enabled' || (features.daily === 'admin' && (user.permissions?.isCreator || user.permissions?.isTester || user.permissions?.isModerator));
      const currentStreak = user.dailyStreak || 0;
      const userNotificationKey = `${user.id}_${today}`;

      if (isDailyEnabled && lastAnswered !== today && lastAnswered !== yesterday) {
        // Missed doing the challenge the previous day (or earlier)
        if (currentStreak > 0) {
          let missedDays = 1;
          if (lastAnswered) {
            try {
              const lastDateArray = lastAnswered.split('-').map(Number);
              const todayDateArray = today.split('-').map(Number);
              const lastDate = new Date(lastDateArray[0], lastDateArray[1] - 1, lastDateArray[2]);
              const todayDate = new Date(todayDateArray[0], todayDateArray[1] - 1, todayDateArray[2]);
              const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
              const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
              missedDays = Math.max(1, diffDays - 1);
            } catch (err) {
              console.error("Spark protection date parsing error:", err);
              missedDays = 1;
            }
          }

          const userSparks = user.sparks || 0;
          if (userSparks >= missedDays) {
            // Streak saver (spark) used automatically to protect the streak
            const totalSparksUsed = (user.unseenSparksUsed || 0) + missedDays;
            updates.sparks = userSparks - missedDays;
            updates.lastDailyAnsweredDate = yesterday; // Protect streak up to yesterday
            updates.unseenSparksUsed = 0;
            updates.lastSparkSavedNotificationDate = today;
            updates.isStreakSavedBySpark = true;
            updates.streakSavedDate = today;
            needsUpdate = true;

            if (!hasNotifiedStreakRef.current[userNotificationKey]) {
              hasNotifiedStreakRef.current[userNotificationKey] = true;
              showNotification(`Streak saved! Used ${totalSparksUsed} Spark${totalSparksUsed > 1 ? 's' : ''} to protect your ${currentStreak}-day streak.`, "info");
            }
          } else {
            // Streak saver unavailable/insufficient -> streak reset to 0
            updates.dailyStreak = 0;
            updates.previousDailyStreak = currentStreak;
            updates.unseenSparksUsed = 0;
            updates.isStreakSavedBySpark = false;
            updates.streakSavedDate = null;
            needsUpdate = true;

            if (!hasNotifiedStreakRef.current[userNotificationKey]) {
              hasNotifiedStreakRef.current[userNotificationKey] = true;
              showNotification(`Daily challenge streak reset to 0 because a day was missed.`, "warning");
            }
          }
        }
      } else if (user.unseenSparksUsed && user.unseenSparksUsed > 0 && user.lastSparkSavedNotificationDate !== today) {
        // Show consolidated notification for unseen sparks used previously
        const totalSparksUsed = user.unseenSparksUsed;
        updates.unseenSparksUsed = 0;
        updates.lastSparkSavedNotificationDate = today;
        needsUpdate = true;

        if (!hasNotifiedStreakRef.current[userNotificationKey]) {
          hasNotifiedStreakRef.current[userNotificationKey] = true;
          showNotification(`Streak saved! Used ${totalSparksUsed} Spark${totalSparksUsed > 1 ? 's' : ''} to protect your ${currentStreak}-day streak.`, "info");
        }
      }

      if (needsUpdate) {
        // If we need to fetch team stats for passive XP, we can do it async.
        if (user.teamId && globalSettings?.totalLitterStats?.piecesCount) {
          getDoc(doc(db, "teams", user.teamId)).then((teamSnap) => {
            if (teamSnap.exists()) {
              const teamData = teamSnap.data() as Team;
              const teamPieces = teamData.litterStats?.piecesCount || 0;
              const totalPieces = globalSettings.totalLitterStats.piecesCount;
              if (totalPieces > 0 && teamPieces > 0) {
                const percentage = (teamPieces / totalPieces) * 100;
                const userLevel = getRankInfo(user.totalXP).level;
                const reward = Math.floor((userLevel / 2) * percentage);
                
                if (reward > 0) {
                  const updatedUser = recordDailyScrap(user, reward);
                  updates.totalXP = updatedUser.totalXP;
                  updates.availableXP = updatedUser.availableXP;
                  updates.availableScrap = updatedUser.availableScrap;
                  updates.monthlyXP = updatedUser.monthlyXP;
                  updates.dailyEarnings = updatedUser.dailyEarnings;
                }
              }
            }
            updateDoc(doc(db, "users", user.id), updates).catch(e => {
              console.error("Failed to update user login:", e);
              setAppError("Failed to synchronize user data.");
            });
          });
        } else {
          updateDoc(doc(db, "users", user.id), updates).catch(e => {
             console.error("Failed to update user login:", e);
             setAppError("Failed to synchronize user data.");
          });
        }
      }
    }
  }, [user, globalSettings, features, showNotification]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, "meta", "globalSettings"), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalSettings(docSnap.data() as GlobalSettings);
      } else {
        // Only attempt to create if we are admin or it's a new setup
        // But setDoc will fail anyway if not admin, so we catch it
        const initialSettings: GlobalSettings = {
          id: "globalSettings",
          showPublicStats: false,
          totalLitterStats: { weightKg: 0, areaSqM: 0, piecesCount: 0 }
        };
        setDoc(doc(db, "meta", "globalSettings"), initialSettings).catch(e => console.warn("Could not initialize global settings:", e));
      }
    }, (err) => {
      console.warn("Global settings listener error:", err);
      handleFirestoreError(err, OperationType.GET, "meta/globalSettings");
    });
    return () => unsub();
  }, [auth.currentUser]);

  useEffect(() => {
    if (user && user.warningCount > (user.lastSeenWarningCount || 0)) {
      const lastWarning = user.blockHistory?.filter(h => h.type === 'warning').sort((a, b) => b.timestamp - a.timestamp)[0];
      setWarningReason(lastWarning?.reason || '');
      setShowWarningPopup(true);
      // Update lastSeenWarningCount in Firestore immediately so it only shows once
      handleUpdateUser({ ...user, lastSeenWarningCount: user.warningCount });
    }
  }, [user?.warningCount, user?.lastSeenWarningCount]);

  useEffect(() => {
    if (user && user.teamId && (user.banLevel || 0) >= 1) {
      const kickUser = async () => {
        try {
          const teamRef = doc(db, 'teams', user.teamId!);
          await updateDoc(teamRef, {
            members: arrayRemove(user.username),
            admins: arrayRemove(user.username)
          });
          await updateDoc(doc(db, 'users', user.id), {
            teamId: deleteField(),
            teamName: deleteField(),
            teamRole: deleteField()
          });
          showNotification('You have been removed from your crew due to a ban.', 'error');
        } catch (err) {
          console.error('Error kicking user:', err);
        }
      };
      kickUser();
    }
  }, [user?.banLevel, user?.teamId]);

  useEffect(() => {
    const checkBuddyParam = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const buddyId = urlParams.get('buddy');
      if (buddyId && user && buddyId !== user.id) {
        const handledKey = `buddy_handled_${buddyId}`;
        if (!sessionStorage.getItem(handledKey)) {
          handleSendFriendRequest(buddyId);
          sessionStorage.setItem(handledKey, 'true');
          showNotification("Sent friend request to buddy from link!", "success");
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }
      }
    };
    checkBuddyParam();
  }, [user?.id]);

  const handleInviteFriend = async () => {
    const inviteUrl = `${window.location.origin}?buddy=${user.id}`;
    const shareData = {
      title: 'Join me on LitterLooker!',
      text: 'Help me clean up the world and earn rewards! Join LitterLooker today.',
      url: inviteUrl
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        if (!user.hasInvitedFriend) {
          handleUpdateUser({ ...user, hasInvitedFriend: true });
        }
      } catch (err: any) {
        if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
          console.log('Invite share cancelled by user');
        } else {
          console.error('Error sharing:', err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        showNotification("Invite link copied to clipboard!", "info");
        if (!user.hasInvitedFriend) {
          handleUpdateUser({ ...user, hasInvitedFriend: true });
        }
      } catch (err) {
        showNotification("Failed to copy link.", "error");
      }
    }
  };

  const onCompleteDailyChallenge = async (corrects: number, reward: number, history: any[]) => {
    if (!user) return;
    const today = getLocalDateString();
    
    // Calculate final streak
    let newStreak = user.dailyStreak || 0;
    const prevStreak = user.dailyStreak || 0;
    
    if (corrects > 0) {
      const yesterday = getLocalDateString(new Date(Date.now() - 86400000));
      if (user.lastDailyAnsweredDate === yesterday) {
        newStreak += 1;
      } else if (user.lastDailyAnsweredDate !== today) {
        newStreak = 1;
      }
    } else {
      // If 0 correct, they lose the streak unless they use a spark
      newStreak = 0;
    }

    const updates: any = {
      lastDailyAnsweredDate: today,
      hasEndedChallengeToday: true,
      currentChallengeHistory: history,
      currentChallengeReward: reward,
      currentChallengeQuestionsAnswered: corrects,
      dailyStreak: newStreak,
      previousDailyStreak: prevStreak, // Save for potential spark usage
      isStreakSavedBySpark: false, // Completing today's challenge restores/extends full active streak
      streakSavedDate: null
    };

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }

    try {
      if (reward > 0) {
        const updatedUser = recordDailyScrap(user, reward);
        updates.totalXP = updatedUser.totalXP;
        updates.availableXP = updatedUser.availableXP;
        updates.monthlyXP = updatedUser.monthlyXP;
        updates.dailyEarnings = updatedUser.dailyEarnings;
        
        // Check for level up
        const oldLevel = getRankInfo(user.totalXP).level;
        const newLevel = getRankInfo(updatedUser.totalXP).level;
        if (newLevel > oldLevel) {
          updates.sparks = (user.sparks || 0) + (newLevel - oldLevel);
          showNotification(`Level Up! You earned ${newLevel - oldLevel} Spark${newLevel - oldLevel > 1 ? 's' : ''}!`, "success");
        }
      }
      
      await updateDoc(doc(db, "users", user.id), updates);
      showNotification(reward > 0 ? `Challenge ended! Banked ${reward} XP.` : "Challenge ended!", "info");
    } catch (e) {
      console.error("Failed to complete daily challenge", e);
    }
  };

  const onUseSpark = async () => {
    if (!user || (user.sparks || 0) <= 0 || (user.previousDailyStreak || 0) <= 1) return;
    try {
      const today = getLocalDateString();
      // If used, it should maintain the streak if they got 0 correct.
      // We restore the streak to what it was BEFORE the final increment/reset if they want to "save" it.
      await updateDoc(doc(db, "users", user.id), {
        sparks: increment(-1),
        dailyStreak: user.previousDailyStreak || 0, // Restore streak
        hasEndedChallengeToday: true, // Keep it ended but streak is back
        isStreakSavedBySpark: true,
        streakSavedDate: today
      });
      handleUpdateUser({
        ...user,
        sparks: (user.sparks || 0) - 1,
        dailyStreak: user.previousDailyStreak || 0,
        hasEndedChallengeToday: true,
        isStreakSavedBySpark: true,
        streakSavedDate: today
      });
      showNotification(`Streak saved! Used 1 Spark to protect your ${user.previousDailyStreak}-day streak.`, "info");
    } catch (e) {
      console.error("Failed to use spark", e);
    }
  };

  const [showSanctionWarning, setShowSanctionWarning] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  
  const hasIncrementedAppOpen = useRef(false);
  const hasNotifiedStreakRef = useRef<Record<string, boolean>>({});
  
  const prevLevelRef = useRef<number>(1);
  const sessionInitialized = useRef(false);
  const isCreatingAccount = useRef(false);

  useEffect(() => {
    if (!currentNotification && notificationQueue.length > 0) {
      const nextNotif = notificationQueue[0];
      setCurrentNotification(nextNotif);
      setNotificationQueue(prev => prev.slice(1));
      
      if (nextNotif.type === 'error') {
        audioService.playWarning();
      } else {
        audioService.playCalmPing();
      }
    }
  }, [currentNotification, notificationQueue]);

  useEffect(() => {
    if (!process.env.GEMINI_API_KEY && !process.env.API_KEY) {
      console.warn("Gemini API Key is missing. AI features will be disabled.");
      if (user?.isAdmin) {
        showNotification("Gemini API Key is missing! AI features are disabled. Please set GEMINI_API_KEY in settings.", "warning");
      }
    }
  }, [user?.isAdmin, showNotification]);

  // Sync Data Logic
  useEffect(() => {
    if (!user || !user.id || !auth.currentUser) return;

    const unsubs: Unsubscribe[] = [];
    
    const fetchInitialMeta = async () => {
      try {
        const announceSnap = await getDoc(doc(db, "meta", "announcement"));
        if (announceSnap.exists()) setAnnouncement(announceSnap.data() as Announcement);
        
        // Try to get security meta, but don't crash if restricted
        try {
          const securitySnap = await getDoc(doc(db, "meta", "security"));
          if (securitySnap.exists()) {
            const secData = securitySnap.data();
            setIsLockedDown(secData?.isLockedDown || false);
            setLockdownReason(secData?.lockdownReason || '');
            setAdminList(secData?.admins || []);

            // Shop Key Management
            const todayStr = getLocalDateString();
            if (secData?.shopKeyDate !== todayStr) {
              const newKey = Math.floor(1000 + Math.random() * 9000).toString();
              await updateDoc(doc(db, "meta", "security"), {
                shopKey: newKey,
                shopKeyDate: todayStr
              });
            }
          }
        } catch (secErr) {
          console.warn("Could not fetch security meta (restricted):", secErr);
        }

        // Fetch users once as a fallback if listener fails
        try {
          const usersSnap = await getDocs(collection(db, "users"));
          const users: Record<string, UserProfile> = {};
          usersSnap.forEach((doc) => {
            const u = doc.data() as UserProfile;
            users[doc.id] = { ...u, id: doc.id };
          });
          setAllUsers(users);
        } catch (userErr) {
          console.warn("Could not fetch all users (restricted):", userErr);
        }

        // Fetch group cleanups once as a fallback from pins collection
        try {
          const cleanupsSnap = await getDocs(query(collection(db, "pins"), where("type", "==", "cleanup")));
          const cleanupsArr = cleanupsSnap.docs.map(doc => ({ ...doc.data() as GroupCleanup, id: doc.id }));
          setGroupCleanups(cleanupsArr);
        } catch (err) {
          console.warn("Could not fetch group cleanups from pins (restricted):", err);
        }

        // Fetch notifications once as a fallback
        try {
          const notificationsSnap = await getDocs(query(collection(db, "notifications"), where("targetUserId", "==", user.id), where("read", "==", false)));
          // We don't necessarily want to trigger toasts for old notifications here, 
          // but we could mark them as read if we wanted.
        } catch (err) {
          console.warn("Could not fetch notifications (restricted):", err);
        }
      } catch (e) {}
    };

    fetchInitialMeta();

    unsubs.push(onSnapshot(doc(db, "meta", "leaderboard"), (snap) => {
      setCriticalDataLoaded(prev => ({...prev, leaderboard: true}));
      if (snap.exists()) setLastResetMonth(snap.data().lastResetMonth);
      else setDoc(doc(db, "meta", "leaderboard"), { lastResetMonth: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date()) });
    }, (err) => {
      if (auth.currentUser) handleFirestoreError(err, OperationType.GET, "meta/leaderboard");
    }));

    unsubs.push(onSnapshot(doc(db, "meta", "announcement"), (snap) => {
      if (snap.exists()) setAnnouncement(snap.data() as Announcement);
    }, (err) => {
      if (auth.currentUser) handleFirestoreError(err, OperationType.GET, "meta/announcement");
    }));

    unsubs.push(onSnapshot(doc(db, "meta", "security"), (snap) => {
      if (snap.exists()) {
        const secData = snap.data();
        setIsLockedDown(secData?.isLockedDown || false);
        setLockdownReason(secData?.lockdownReason || '');
        setAdminList(secData?.admins || []);
        setIsAdminPanelValid(secData?.adminPanelValid === true);
        setIsModPanelValid(secData?.modPanelValid === true);
        if (secData?.features) setFeatures(prev => ({...prev, ...secData.features}));
      }
    }, (err) => {
      if (auth.currentUser) {
        console.warn("Security listener error (likely permission denied):", err);
        handleFirestoreError(err, OperationType.GET, "meta/security");
      }
    }));

    unsubs.push(onSnapshot(collection(db, "pins"), (snap) => {
      const allItems = (snap as any).docs.map((doc: any) => ({ ...doc.data(), id: doc.id }));
      
      let pinsArr = allItems.filter((item: any) => !item.type || item.type === 'pin').map((p: any) => ({
        ...p,
        status: p.status || 'pending'
      }));
      
      try {
        const pendingStr = localStorage.getItem('pendingPins');
        if (pendingStr) {
          const pending = JSON.parse(pendingStr);
          pending.forEach((p: any) => {
            if (!pinsArr.some((existing: any) => existing.id === p.id)) {
              p.isPendingOffline = true;
              pinsArr.push(p);
            }
          });
        }

        const pendingProgStr = localStorage.getItem('pendingProgress');
        if (pendingProgStr) {
          const pendingProgress = JSON.parse(pendingProgStr);
          pendingProgress.forEach((item: any) => {
             const pinIndex = pinsArr.findIndex((p: any) => p.id === item.pid);
             if (pinIndex !== -1) {
                const alreadyExists = pinsArr[pinIndex].progressReports?.some((r: any) => r.id === item.r.id);
                if (!alreadyExists) {
                  const report = { ...item.r, isPendingOffline: true };
                  pinsArr[pinIndex] = { ...pinsArr[pinIndex], progressReports: [...(pinsArr[pinIndex].progressReports || []), report] };
                }
             }
          });
        }
      } catch(e) {}

      setPins(pinsArr.sort((a: any, b: any) => b.timestamp - a.timestamp));
      
      const cleanupsArr = allItems.filter((item: any) => item.type === 'cleanup');
      setGroupCleanups(cleanupsArr);
    }, (err) => {
      if (auth.currentUser) handleFirestoreError(err, OperationType.GET, "pins");
    }));

    unsubs.push(onSnapshot(collection(db, "posts"), (snap) => {
      setCriticalDataLoaded(prev => ({...prev, posts: true}));
      const postsArr = (snap as any).docs.map((doc: any) => ({ ...doc.data() as CommunityPost, id: doc.id }));
      setPosts(postsArr.sort((a, b) => b.timestamp - a.timestamp));
    }, (err) => {
      if (auth.currentUser) handleFirestoreError(err, OperationType.GET, "posts");
    }));

    unsubs.push(onSnapshot(collection(db, "zones"), (snap) => {
      const zonesArr = (snap as any).docs.map((doc: any) => ({ ...doc.data() as MultiplierZone, id: doc.id }));
      setZones(zonesArr);
    }, (err) => {
      if (auth.currentUser) handleFirestoreError(err, OperationType.GET, "zones");
    }));

    unsubs.push(onSnapshot(collection(db, "users"), (snap) => {
      const users: Record<string, UserProfile> = {};
      (snap as any).forEach((doc: any) => {
        const u = doc.data() as UserProfile;
        users[doc.id] = { ...u, id: doc.id };
      });
      setAllUsers(users);
    }, (err) => {
      if (auth.currentUser) {
        console.warn("Users listener error (likely permission denied):", err);
        handleFirestoreError(err, OperationType.GET, "users");
      }
    }));

    // Notification Listener for Group Cleanups
    const notificationsQuery = query(collection(db, "notifications"), where("targetUserId", "==", user.id), where("read", "==", false));
    unsubs.push(onSnapshot(notificationsQuery, (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          showNotification(data.message, "info");
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("LitterLooker", {
              body: data.message,
              icon: '/vite.svg'
            });
          }
          await updateDoc(doc(db, "notifications", change.doc.id), { read: true });
        }
      });
    }, (err) => {
      if (auth.currentUser) {
        console.warn("Notifications listener restricted:", err);
        handleFirestoreError(err, OperationType.GET, "notifications");
      }
    }));

    return () => unsubs.forEach(unsub => unsub());
  }, [user?.id, user?.isAdmin]);

  // debug
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        setAppError("DEBUG_TRIGGERED_ERROR");
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Removed Loading Check timeout that sets AppError

  // Purge old zones (User Request Fix)
  useEffect(() => {
    if (!user || !user.isAdmin) return;
    const purgeOldZones = async () => {
      try {
        // Cutoff: 2026-03-01 14:30:00 (approx)
        const cutoff = 1772404200000; 
        const q = query(collection(db, "zones"), where("timestamp", "<", cutoff));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          console.log(`System: Purged ${snapshot.size} old zones.`);
        }
      } catch (e) {
        console.error("Zone purge failed:", e);
      }
    };
    purgeOldZones();
  }, [user]);

  // Update lastActiveAt periodically
  useEffect(() => {
    if (!user) return;
    
    const updateLastActive = async () => {
      try {
        await updateDoc(doc(db, "users", user.id), { lastActiveAt: Date.now() });
      } catch (e) {
        console.warn("Failed to update lastActiveAt", e);
      }
    };

    updateLastActive();
    const interval = setInterval(updateLastActive, 60000); // Every minute
    return () => clearInterval(interval);
  }, [user?.id]);

  // Blocking Logic
  const blockedUserIds = React.useMemo(() => user?.blockedUsers || [], [user?.blockedUsers]);
  
  const allUsersRef = useRef(allUsers);
  const uidMapRef = useRef<Record<string, UserProfile>>({});
  useEffect(() => {
    allUsersRef.current = allUsers;
    const newUidMap: Record<string, UserProfile> = {};
    Object.values(allUsers).forEach((u: any) => {
      if (u.uid) newUidMap[u.uid] = u;
    });
    uidMapRef.current = newUidMap;
  }, [allUsers]);

  const isUserVisible = useCallback((targetIdentifier?: string) => {
    if (!user || !targetIdentifier) return true;
    if (user.id === targetIdentifier || user.uid === targetIdentifier) return true; // Always see self
    
    // 1. Direct check (if targetIdentifier is the blocked ID/Username)
    if (Array.isArray(blockedUserIds) && blockedUserIds.includes(targetIdentifier)) {
      return false;
    }

    // 2. Resolve User Profile to check cross-reference (UID vs Username)
    let target = allUsersRef.current[targetIdentifier]; // Try looking up by Username (ID)
    if (!target) {
      // Try looking up by UID
      target = uidMapRef.current[targetIdentifier];
    }

    if (target) {
      // Check if the resolved user's ID (Username) is blocked
      if (Array.isArray(blockedUserIds) && (blockedUserIds.includes(target.id) || (target.uid && blockedUserIds.includes(target.uid)))) {
        return false;
      }
      
      // Check if target blocked me
      if (Array.isArray(target.blockedUsers) && (target.blockedUsers.includes(user.id) || (user.uid && target.blockedUsers.includes(user.uid)))) {
        return false;
      }
    }
    
    return true;
  }, [user, blockedUserIds]);

  const visiblePosts = React.useMemo(() => {
    return posts.filter(p => isUserVisible(p.username) && isUserVisible(p.userId));
  }, [posts, isUserVisible]);

  const visiblePins = React.useMemo(() => {
    let filtered = pins.filter(p => isUserVisible(p.username) && isUserVisible(p.userId));
    filtered = filtered.filter(p => p.status !== 'cleaned');
    // Ensure all pins in the user's area can be seen reliably without double-filtering cutoffs
    const radius = user?.mapRadiusFilter || 100;
    if (user && userLocation) {
      filtered = filtered.filter(pin => {
        if (focusPinId && pin.id === focusPinId) return true;
        if (user && (pin.userId === user.id || pin.username === user.username)) return true;
        const pinLat = Number(pin.lat);
        const pinLng = Number(pin.lng);
        if (isNaN(pinLat) || isNaN(pinLng)) return true;
        const distMeters = calculateDistance(userLocation.lat, userLocation.lng, pinLat, pinLng);
        const distMiles = distMeters / 1609.344;
        return distMiles <= Math.max(radius * 1.5, 25); // Generous margin so pins on the edge of the user's area never flicker or disappear
      });
    }
    return filtered;
  }, [pins, isUserVisible, user, userLocation, focusPinId]);

  const visibleCleanups = React.useMemo(() => {
    let filtered = groupCleanups.filter(c => isUserVisible(c.creatorId));
    const radius = user?.mapRadiusFilter;
    if (user && radius && userLocation) {
      filtered = filtered.filter(cleanup => {
        const distMeters = calculateDistance(userLocation.lat, userLocation.lng, cleanup.lat, cleanup.lng);
        const distMiles = distMeters / 1609.344;
        return distMiles <= (radius * 1.05);
      });
    }
    return filtered;
  }, [groupCleanups, isUserVisible, user, userLocation]);
  
  const visibleUsersMap = React.useMemo(() => {
    const filtered: Record<string, UserProfile> = {};
    Object.keys(allUsers).forEach(key => {
        if (isUserVisible(key)) filtered[key] = allUsers[key];
    });
    return filtered;
  }, [allUsers, isUserVisible]);

  const [selectedCrewId, setSelectedCrewId] = useState<string | undefined>(undefined);

  const handleUpdateUser = async (updated: UserProfile) => {
    try {
      if (!user) return;
      
      // Calculate XP difference for team update
      const xpDiff = updated.totalXP !== -1 && user.totalXP !== -1 ? updated.totalXP - user.totalXP : 0;
      
      // Check for level up to award Sparks
      const oldLevel = getRankInfo(user.totalXP).level;
      const newLevel = getRankInfo(updated.totalXP).level;
      if (newLevel > oldLevel && updated.totalXP !== -1) {
        updated.sparks = (updated.sparks || 0) + (newLevel - oldLevel);
        showNotification(`Level Up! You earned ${newLevel - oldLevel} Spark${newLevel - oldLevel > 1 ? 's' : ''}!`, "success");
      }

      // Optimistic update for immediate UI feedback
      setUser(prev => prev ? { ...prev, ...updated } : updated);

      // Ensure we use the correct document ID (either ID or UID preference)
      const docId = updated.id || user.id;
      if (!docId) {
        console.error("No valid document ID for user update");
        return;
      }

      try {
        await updateDoc(doc(db, "users", docId), sanitizeData(updated));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${docId}`);
      }

      // Update team XP if user is in a team and earned XP
      if (xpDiff > 0 && updated.teamId) {
        const teamRef = doc(db, "teams", updated.teamId);
        const teamSnap = await getDoc(teamRef);
        if (teamSnap.exists()) {
          const currentTeamXP = teamSnap.data().totalXP || 0;
          const newTeamXP = currentTeamXP + xpDiff;
          const newLevel = getRankInfo(newTeamXP).level;
          await updateDoc(teamRef, {
            totalXP: newTeamXP,
            level: newLevel
          });
        }
      }
    } catch (err: any) {
      console.error("Update failed:", err);
      // If it's the JSON error from handleFirestoreError, it will be logged by that
      showNotification("Error updating profile. Check console for details.", "error");
    }
  };

  // Sanction Logic with Immediate Enforcement, Rolling Hourly Reset, and Yearly Amnesty
  useEffect(() => {
    if (!user || user.isAdmin) return;

    const currentLevel = getRankInfo(user.totalXP).level;
    const now = Date.now();
    const currentYear = new Date(now).getFullYear();
    const oneHour = 3600000;
    
    // 1. Yearly Amnesty Reset (January 1st)
    if (user.lastViolationAt) {
      const lastViolationYear = new Date(user.lastViolationAt).getFullYear();
      if (currentYear > lastViolationYear && (user.banLevel || 0) > 0) {
        handleUpdateUser({ ...user, banLevel: 0, warningCount: 0 });
        return;
      }
    }

    // 2. Rolling Hourly Warning Reset Check
    if (user.lastWarningAt && (now - user.lastWarningAt > oneHour) && (user.warningCount || 0) > 0) {
      handleUpdateUser({ ...user, warningCount: 0 });
      return;
    }

    const warnCount = user.warningCount || 0;
    
    // 3. Immediate Threshold Monitoring
    if (warnCount > currentLevel) {
      const currentBanLevel = user.banLevel || 0;

      // Level 1: Initial Overlay Warning
      if (currentBanLevel === 0) {
        setShowSanctionWarning(`URGENT: You have received ${warnCount} warnings this hour, exceeding your Level ${currentLevel} allowance. Further violations will result in immediate suspension.`);
        handleUpdateUser({
          ...user,
          banLevel: 1,
          lastViolationAt: now
        });
      } 
      // Escalation for repeated/recent infractions
      else if (now - (user.lastWarningAt || 0) < 10000) { 
        let blockDuration = 0;
        let nextBanLevel = currentBanLevel;
        let blockReason = "Exceeded hourly warning limit and failed integrity checks.";
        let type: BlockEvent['type'] = 'warning';

        if (currentBanLevel === 1) { // 24-Hour block
          blockDuration = 24 * 60 * 60 * 1000;
          nextBanLevel = 2;
          type = 'day';
        } else if (currentBanLevel === 2) { // 7-Day block
          blockDuration = 7 * 24 * 60 * 60 * 1000;
          nextBanLevel = 3;
          type = 'week';
        } else if (currentBanLevel >= 3) { // Permanent Ban
          nextBanLevel = 4;
          type = 'ban';
        }

        const event: BlockEvent = { type, timestamp: now, reason: blockReason };
        handleUpdateUser({
          ...user,
          banLevel: nextBanLevel,
          blockedUntil: type === 'ban' ? 9999999999999 : now + blockDuration,
          blockReason,
          lastViolationAt: now,
          blockHistory: [...(user.blockHistory || []), event]
        });
      }
    }
  }, [user?.warningCount]);

  const handleSendFriendRequest = async (targetId: string) => {
    if (!user) return;
    if ((user.friends || []).includes(targetId)) { showNotification("Already buddies!", "warning"); return; }
    
    // Check if target has already sent a request to current user
    const existingReceived = user.friendRequests?.find(r => r.fromUserId === targetId);
    if (existingReceived) {
      handleAcceptFriendRequest(targetId);
      return;
    }

    // Check if current user already sent a request to target
    const targetUser = allUsers[targetId];
    if (targetUser && (targetUser.friendRequests || []).some(r => r.fromUserId === user.id)) {
      showNotification("Request already pending!", "warning");
      return;
    }

    const request: FriendRequest = { fromUserId: user.id, fromUsername: user.username, timestamp: Date.now() };
    try {
      await updateDoc(doc(db, "users", targetId), { friendRequests: arrayUnion(request) });
      showNotification("Mending Buddy request sent!", "info");
    } catch (e: any) { showNotification("Error sending request.", "error"); }
  };

  const handleAcceptFriendRequest = async (fromUserId: string) => {
    if (!user) return;
    const request = user.friendRequests?.find(r => r.fromUserId === fromUserId);
    if (!request) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([60, 40, 60, 40, 80]);
      }
      await updateDoc(doc(db, "users", user.id), { friends: arrayUnion(fromUserId), friendRequests: arrayRemove(request) });
      await updateDoc(doc(db, "users", fromUserId), { friends: arrayUnion(user.id) });
      showNotification("New buddy added!", "info");
    } catch (e: any) { showNotification("Error accepting request.", "error"); }
  };

  const handleDeclineFriendRequest = async (fromUserId: string) => {
    if (!user) return;
    const request = user.friendRequests?.find(r => r.fromUserId === fromUserId);
    if (!request) return;
    try {
      await updateDoc(doc(db, "users", user.id), { friendRequests: arrayRemove(request) });
      showNotification("Request declined.", "warning");
    } catch (e: any) { showNotification("Error declining request.", "error"); }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.id), { friends: arrayRemove(friendId) });
      await updateDoc(doc(db, "users", friendId), { friends: arrayRemove(user.id) });
      showNotification("Mending Buddy removed.", "warning");
    } catch (e: any) { showNotification("Error removing buddy.", "error"); }
  };

  const handleBlockUser = async (targetId: string) => {
    if (!user) return;
    console.log("Blocking user:", targetId);
    try {
      // 1. Calculate new state
      const currentBlocked = user.blockedUsers || [];
      if (currentBlocked.includes(targetId)) {
         showNotification("User already blocked.", "warning");
         return;
      }
      
      const updatedBlocked = [...currentBlocked, targetId];
      const updatedFriends = (user.friends || []).filter(id => id !== targetId);
      
      // 2. Optimistic Local Update
      const updatedUser = { ...user, blockedUsers: updatedBlocked, friends: updatedFriends };
      setUser(updatedUser);
      showNotification("User blocked.", "info");
      
      // 3. Firestore Update (Parallel)
      const userRef = doc(db, "users", user.id);
      const targetRef = doc(db, "users", targetId);
      
      await Promise.all([
        updateDoc(userRef, {
          blockedUsers: arrayUnion(targetId),
          friends: arrayRemove(targetId)
        }),
        updateDoc(targetRef, {
          friends: arrayRemove(user.id)
        })
      ]);

    } catch (e: any) {
      console.error("Error blocking user:", e);
      showNotification("Error blocking user.", "error");
    }
  };

  const handleReportUser = async (targetId: string, targetUsername: string, reason: string) => {
    if (!user) return;
    try {
      const reportId = `${user.id}_${targetId}_${Date.now()}`;
      const report: UserReport = {
        id: reportId,
        reporterId: user.id,
        reporterUid: user.uid || '',
        reporterUsername: user.username,
        targetUserId: targetId,
        targetUsername: targetUsername,
        reason: reason || "User reported from profile",
        timestamp: Date.now(),
        status: 'pending'
      };
      
      await setDoc(doc(db, "moderation", reportId), report);
      showNotification("User reported. Thank you for keeping LitterLooker safe!", "info");
    } catch (e) {
      console.error("Error reporting user:", e);
      showNotification("Failed to submit report.", "error");
      handleFirestoreError(e, OperationType.CREATE, "moderation");
    }
  };

  const handleTagUsers = useCallback(async (usernames: string[], rewardAmount: number = 0) => {
    if (!user || !usernames || usernames.length === 0) return;
    const uniqueUsernames = Array.from(new Set(usernames)).filter(u => u !== user.username);
    if (uniqueUsernames.length === 0) return;
    const updatedUser = { ...user, totalUsersTaggedCount: (user.totalUsersTaggedCount || 0) + uniqueUsernames.length };
    await handleUpdateUser(updatedUser);
    for (const username of uniqueUsernames) {
      const targetUser = allUsers[username];
      if (targetUser) {
        const userRef = doc(db, "users", targetUser.id);
        const today = getLocalDateString();
        const dailyEarnings = { ...(targetUser.dailyEarnings || {}) };
        const updates: any = { timesTaggedCount: (targetUser.timesTaggedCount || 0) + 1, hasBeenTagged: true };
        if (rewardAmount > 0) {
          const isInfinity = targetUser.totalXP === -1;
          dailyEarnings[today] = (dailyEarnings[today] || 0) + rewardAmount;
          updates.totalXP = isInfinity ? -1 : (targetUser.totalXP || 0) + rewardAmount;
          updates.availableXP = (targetUser.availableXP || 0) + rewardAmount;
          updates.monthlyXP = (targetUser.monthlyXP || 0) + rewardAmount;
          updates.dailyEarnings = dailyEarnings;
        }
        await updateDoc(userRef, sanitizeData(updates));
      }
    }
  }, [user, allUsers, handleUpdateUser]);

  const calculateLeaderboardReward = (rank: number): number => {
    if (rank === 1) return 12500;
    if (rank === 2) return 8000;
    if (rank === 3) return 5000;
    if (rank > 3) {
      let reward = 5000;
      for (let i = 4; i <= rank; i++) {
        reward = Math.floor(reward * 0.75);
      }
      return Math.max(reward, 0);
    }
    return 0;
  };

  const getNewUserLeaderboardId = useCallback((usersList: UserProfile[]) => {
    // Count users in each existing leaderboard
    const counts: Record<string, number> = {};
    usersList.forEach(u => {
      const targetLb = u.nextLeaderboardId || u.leaderboardId;
      if (targetLb) {
        counts[targetLb] = (counts[targetLb] || 0) + 1;
      }
    });

    // Find all leaderboards with < 20 users
    const availableLBs = Object.keys(counts).filter(lbId => counts[lbId] < 20);
    
    if (availableLBs.length > 0) {
      // Pick one randomly from available non-full shards
      return availableLBs[Math.floor(Math.random() * availableLBs.length)];
    }
    
    // If all full, create a new one. To avoid overlap when creating new shards concurrently,
    // we use the max index + 1 instead of just length.
    let maxIndex = -1;
    Object.keys(counts).forEach(lbId => {
      if (lbId.startsWith('LB_')) {
        const idx = parseInt(lbId.replace('LB_', ''), 10);
        if (!isNaN(idx) && idx > maxIndex) {
          maxIndex = idx;
        }
      }
    });
    
    return `LB_${maxIndex + 1}`;
  }, []);

  useEffect(() => {
    if (user && !hasIncrementedAppOpen.current) {
      const isNewUser = (user.appOpenCount || 0) === 0;
      handleUpdateUser({
        ...user,
        appOpenCount: (user.appOpenCount || 0) + 1
      });
      hasIncrementedAppOpen.current = true;
      
      if (isNewUser || !user.hasSeenTutorial) {
        setShowTutorial(true);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user && user.id) {
      const unsubSelf = onSnapshot(doc(db, "users", user.id), async (snap) => {
        if (snap.exists()) {
          const u = snap.data() as UserProfile;
          const isAdmin = adminList.includes(snap.id);
          setUser(prev => ({ ...(prev || u), ...u, id: snap.id, uid: auth.currentUser?.uid, isAdmin }));
        }
      }, (err) => {
        console.warn("Self-user listener error:", err);
        handleFirestoreError(err, OperationType.GET, `users/${user.id}`);
      });
      return () => unsubSelf();
    }
  }, [user?.id, adminList]);

  // Shard-based Leaderboard Reset Logic
  useEffect(() => {
    const checkShardReset = async () => {
      if (!user || !user.leaderboardId) return;
      
      const currentMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());
      const shardRef = doc(db, "meta", `shard_${user.leaderboardId}`);
      
      try {
        const shardSnap = await getDoc(shardRef);
        let shardLastReset = '';
        if (shardSnap.exists()) {
          shardLastReset = shardSnap.data().lastResetMonth;
        }
        
        if (!shardSnap.exists()) {
          await setDoc(shardRef, { lastResetMonth: currentMonth });
          return;
        }
        
        if (shardLastReset && shardLastReset !== currentMonth) {
          console.log(`Shard ${user.leaderboardId} needs reset. Resetting...`);
          
          // Fetch all users in this shard
          const shardUsersQuery = query(collection(db, "users"), where("leaderboardId", "==", user.leaderboardId));
          const shardUsersSnap = await getDocs(shardUsersQuery);
          const shardUsers = shardUsersSnap.docs.map(d => ({ ...d.data() as UserProfile, id: d.id }));
          
          const sorted = shardUsers.filter(u => u.totalXP !== -1).sort((a, b) => (b.monthlyXP || 0) - (a.monthlyXP || 0));
          
          await runTransaction(db, async (transaction) => {
            const freshShardSnap = await transaction.get(shardRef);
            if (freshShardSnap.exists() && freshShardSnap.data().lastResetMonth === currentMonth) {
              // Someone else already reset it
              return;
            }

            transaction.set(shardRef, { lastResetMonth: currentMonth }, { merge: true });

            sorted.forEach((u, index) => {
              const rank = index + 1;
              const reward = calculateLeaderboardReward(rank);
              
              const joinedDate = new Date(u.joinedAt || Date.now());
              const joinedMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(joinedDate);
              const isFirstMonth = joinedMonth === shardLastReset;
              
              transaction.update(doc(db, "users", u.id), {
                monthlyXP: 0,
                lastResetMonth: currentMonth,
                pendingLeaderboardReward: (isFirstMonth || (u.monthlyXP || 0) <= 0) ? null : {
                  rank,
                  reward,
                  monthName: shardLastReset.split(' ')[0]
                },
                hasFinishedFirst: rank === 1 && !isFirstMonth ? true : (u.hasFinishedFirst || false),
                leaderboardId: u.nextLeaderboardId || u.leaderboardId,
                nextLeaderboardId: null
              });
            });
          });
          console.log(`Shard ${user.leaderboardId} reset complete.`);
        }
      } catch (err) {
        console.error("Error resetting shard:", err);
      }
    };

    if (user && user.leaderboardId) {
      checkShardReset();
    }
  }, [user?.id, user?.leaderboardId]);

  // Predetermine next shard for seamless transition
  useEffect(() => {
    const predetermineNextShard = async () => {
      if (!user || user.nextLeaderboardId || Object.keys(allUsers).length === 0) return;
      
      // Check if user joined this month
      const joinedDate = new Date(user.joinedAt);
      const now = new Date();
      const isThisMonth = joinedDate.getMonth() === now.getMonth() && joinedDate.getFullYear() === now.getFullYear();
      
      if (isThisMonth) {
        // Do not assign shard until next month
        return;
      }
      
      const allUsersList = Object.values(allUsers) as UserProfile[];
      const nextShardId = getNewUserLeaderboardId(allUsersList);
      
      if (nextShardId !== user.leaderboardId) {
        await updateDoc(doc(db, "users", user.id), { nextLeaderboardId: nextShardId });
      }
    };
    
    if (user && !user.nextLeaderboardId) {
      predetermineNextShard();
    }
  }, [user?.id, user?.nextLeaderboardId, allUsers, getNewUserLeaderboardId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (isCreatingAccount.current) return;
      if (firebaseUser) {
        setIsEmailVerified(firebaseUser.emailVerified);
        try {
          let uDoc = null;
          if (firebaseUser.displayName) uDoc = await getDoc(doc(db, "users", firebaseUser.displayName));
          if (!uDoc?.exists() && firebaseUser.uid) {
            const q = query(collection(db, "users"), where("uid", "==", firebaseUser.uid), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
              uDoc = snap.docs[0];
              if (firebaseUser.displayName !== uDoc.id) {
                await updateProfile(firebaseUser, { displayName: uDoc.id });
                await firebaseUser.getIdToken(true);
              }
            }
          }
          if (uDoc?.exists()) {
            const u = uDoc.data() as UserProfile;
            const updates: Partial<UserProfile> = {};
            if (!sessionInitialized.current) { 
              updates.loginCount = (u.loginCount || 0) + 1; 
              sessionInitialized.current = true; 
            }
            if (!u.uid && firebaseUser.uid) {
              updates.uid = firebaseUser.uid;
            }
            if (Object.keys(updates).length > 0) await updateDoc(doc(db, "users", uDoc.id), sanitizeData(updates));
            setUser({ ...u, ...updates, id: uDoc.id, uid: firebaseUser.uid, isAdmin: adminList.includes(uDoc.id) });
            prevLevelRef.current = getRankInfo(u.totalXP).level;
            
            requestNotificationPermission().then(token => {
              if (token && u.fcmToken !== token) {
                updateDoc(doc(db, "users", uDoc.id), { fcmToken: token }).catch(console.error);
              }
            });
          }
        } catch (e) { console.error("Auth sync error", e); }
      } else { setUser(null); sessionInitialized.current = false; }
      setAuthInitialized(true);
    });
    return unsubscribe;
  }, [adminList]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    if (activeTab !== 'map') return; // Location permission only requested when map page is open
    
    // Request permission immediately on map mount
    const requestLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (e) => {
          console.warn("Location access denied or failed:", e.message);
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
      );
    };

    const options = { 
      enableHighAccuracy: false, 
      timeout: 20000, 
      maximumAge: user?.lowPowerModeEnabled ? 60000 : 0 
    };

    requestLocation();

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (e) => console.warn("Watch position error:", e.message),
      options
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeTab]);

  const checkLowPower = useCallback(async () => {
    // Manual toggle is now used via user.lowPowerModeEnabled
  }, []);

  const setLowPower = () => checkLowPower();
  
  useEffect(() => {
    let unmounted = false;
    
    // Power/Connection check listeners
    const handlePowerChange = () => {
        if (!unmounted) checkLowPower();
    };

    if ('connection' in navigator) {
      (navigator as any).connection.addEventListener('change', handlePowerChange);
    }
    
    let battery: any = null;
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((b: any) => {
        if (unmounted) return;
        battery = b;
        battery.addEventListener('levelchange', handlePowerChange);
        battery.addEventListener('chargingchange', handlePowerChange);
        checkLowPower();
      }).catch(() => {});
    }

    // Run initially
    checkLowPower();

    // iOS Low Power Mode detection via video autoplay rejection
    const video = document.createElement('video');
    video.src = "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAW1wNDFpc29tAAAAHHV1aWRc0uX81/P5T1e0a29Y/o9wVwAAAAAAAAABAAAAN01EQVQIHQEKwP3//wAAABxib29tZXRkYXRhIgABAAIAAAAAAAABAAMAAQA=";
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    
    video.play().catch((e) => {
      if (e.name === 'NotAllowedError' && !unmounted) {
        checkLowPower();
      }
    });

    return () => { 
        unmounted = true; 
        if ('connection' in navigator) {
            (navigator as any).connection.removeEventListener('change', handlePowerChange);
        }
        if (battery) {
            battery.removeEventListener('levelchange', handlePowerChange);
            battery.removeEventListener('chargingchange', handlePowerChange);
        }
    };
  }, [checkLowPower]);

  const calculateMultiplier = useCallback(() => {
    const now = Date.now();
    if (!userLocation || zones.length === 0) { setActiveZone(null); return 1; }
    let maxMultiplier = 1;
    let foundZone: MultiplierZone | null = null;
    zones.forEach(zone => {
      const isStarted = !zone.startTime || now >= zone.startTime;
      const isNotEnded = !zone.endTime || now < zone.endTime;
      if (isStarted && isNotEnded) {
        const dist = calculateDistance(userLocation.lat, userLocation.lng, zone.lat, zone.lng);
        if (dist <= zone.radius && zone.multiplier > maxMultiplier) {
          maxMultiplier = zone.multiplier; foundZone = zone;
        }
      }
    });
    setActiveZone(foundZone); return maxMultiplier;
  }, [userLocation, zones]);

  useEffect(() => {
    calculateMultiplier();
  }, [userLocation, zones, calculateMultiplier]);

  const handleAwardScrap = useCallback((amount: number, skipMultiplier: boolean = false) => {
    const multiplier = skipMultiplier ? 1 : calculateMultiplier();
    const finalAmount = amount * multiplier;
    setScrapGain(prev => (prev || 0) + finalAmount);
    if (!skipMultiplier && multiplier > 1) showNotification(`Zone Active! ${multiplier}x Scrap!`, "info");
    return finalAmount;
  }, [calculateMultiplier, showNotification]);

  useEffect(() => {
    if (user && Object.keys(allUsersRef.current).length > 0) {
      const allUsersList = Object.values(allUsersRef.current) as UserProfile[];
      
      // Migration: If any users are missing leaderboardId, assign them without rebalancing everyone
      const now = new Date();
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const missingIds = allUsersList.filter(u => !u.leaderboardId && u.totalXP !== -1 && (u.joinedAt || 0) < startOfCurrentMonth);
      if (missingIds.length > 0) {
        // Assign missing users to shards one by one to avoid rebalancing settled users
        missingIds.forEach(async (u) => {
          const lbId = getNewUserLeaderboardId(allUsersList);
          await updateDoc(doc(db, "users", u.id), { leaderboardId: lbId, monthlyXP: 0 });
        });
      }

      let needsUpdate = false;
      let userUpdates: Partial<UserProfile> = {};
      const currentLevel = getRankInfo(user.totalXP).level;
      if (currentLevel > prevLevelRef.current) {
        const passedRanks = RANK_SYSTEM.filter(r => r.level > prevLevelRef.current && r.level <= currentLevel);
        if (passedRanks.length > 0) setLevelUpRank(passedRanks[passedRanks.length - 1]);
        prevLevelRef.current = currentLevel;
      } else if (currentLevel < prevLevelRef.current) {
        prevLevelRef.current = currentLevel;
      }
      const allPassedRanks = RANK_SYSTEM.filter(r => r.level <= currentLevel);
      const allRewardIds = allPassedRanks.flatMap(r => r.rewards?.map(rw => rw.id) || []);
      const currentUnlocked = Array.isArray(user.unlockedAssets) ? user.unlockedAssets : [];
      const missingRewards = allRewardIds.filter(id => !currentUnlocked.includes(id));
      if (missingRewards.length > 0) { userUpdates.unlockedAssets = [...currentUnlocked, ...missingRewards]; needsUpdate = true; }
      const dismissedMissedIds = Array.isArray(user.dismissedMissedIds) ? user.dismissedMissedIds : [];
      const totalMissed = pins.filter(p => p.userId !== user.id && p.timestamp > lastSeen && !dismissedMissedIds.includes(p.id)).length + posts.filter(p => p.userId !== user.id && p.timestamp > lastSeen && !dismissedMissedIds.includes(p.id)).length;
      if (totalMissed > (user.maxMissedCount || 0)) { userUpdates.maxMissedCount = totalMissed; needsUpdate = true; }
      const currentCompleted = Array.isArray(user.completedAchievements) ? [...user.completedAchievements] : [];
      const currentEarnedTitles = Array.isArray(user.earnedTitles) ? [...user.earnedTitles] : [];
      let currentUnlockedAssets = userUpdates.unlockedAssets || (Array.isArray(user.unlockedAssets) ? [...user.unlockedAssets] : []);
      let totalAchievementScrap = 0;
      ACHIEVEMENTS_DATA.forEach(achievement => {
        if (!currentCompleted.includes(achievement.id) && achievement.check({ ...user, ...userUpdates, unlockedAssets: currentUnlockedAssets, completedAchievements: currentCompleted }, allUsersRef.current)) {
           showNotification(`Achievement: ${achievement.title}!`, 'success'); 
           currentCompleted.push(achievement.id); totalAchievementScrap += achievement.reward;
           if (achievement.givesTitle && !currentEarnedTitles.includes(achievement.title)) currentEarnedTitles.push(achievement.title);
           if (achievement.givesAsset && !currentUnlockedAssets.includes(achievement.givesAsset.id)) currentUnlockedAssets.push(achievement.givesAsset.id);
           needsUpdate = true;
        }
      });
      if (needsUpdate) {
        let finalUser: UserProfile = { ...user, ...userUpdates, completedAchievements: currentCompleted, earnedTitles: currentEarnedTitles, unlockedAssets: currentUnlockedAssets };
        if (totalAchievementScrap > 0) finalUser = recordDailyScrap(finalUser, totalAchievementScrap, false);
        handleUpdateUser(finalUser);
      }
    }
  }, [user?.totalXP, user?.leaderboardId, user?.hasFinishedFirst, user?.multiplierReportsCount, user?.commentsCount, user?.maxCommentsReceived, user?.cleanupsOrganizedCount, user?.highEfficiencyParticipationsCount, user?.usernameChangeCount, user?.profilePictureChangeCount, user?.friends?.length, user?.timesTaggedCount, user?.totalUsersTaggedCount, user?.clearedPinsCount, user?.pinsSubmittedCount, user?.postsCount, user?.linkedPostsCount, user?.dailyStreak, user?.hasInvitedFriend, user?.appOpenCount, user?.tags?.length, user?.totalReactionsReceived, user?.totalWarningsReceived, user?.maxMissedCount, user?.daily5000XPCount, user?.warningsSentCount, user?.permissions?.isVerified, pins.length, posts.length]);

  const handleToggleReaction = async (postId: string, emoji: string) => {
    if (!user) return;
    const post = posts.find(p => p.id === postId) || (announcement?.id === postId ? (announcement as any) : null);
    if (!post) return;
    const reactions = { ...(post.reactions || {}) };
    const emojiList = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];
    const currentUid = user.uid || auth.currentUser?.uid;
    if (!currentUid) return;
    
    const userIndex = Array.isArray(emojiList) ? emojiList.indexOf(currentUid) : -1;
    const added = userIndex === -1;
    if (added) emojiList.push(currentUid); else emojiList.splice(userIndex, 1);
    reactions[emoji] = emojiList;
    const coll = announcement?.id === postId ? "meta" : "posts";
    const docId = announcement?.id === postId ? "announcement" : postId;
    await updateDoc(doc(db, coll, docId), sanitizeData({ reactions }));
    const authorId = post.username;
    if (authorId && allUsers[authorId]) {
      const author = allUsers[authorId];
      await updateDoc(doc(db, "users", authorId), { totalReactionsReceived: (author.totalReactionsReceived || 0) + (added ? 1 : -1) });
    }
  };

  const handleAddReply = async (postId: string, content: string) => {
    if (!user) return;
    const post = posts.find(p => p.id === postId) || (announcement?.id === postId ? (announcement as any) : null);
    if (!post) return;
    const reply: Reply = { id: Math.random().toString(36).substr(2, 9), userId: user.uid || user.id, username: user.username, userProfilePicture: user.profilePicture, content, timestamp: Date.now() };
    const updatedReplies = sanitizeData([...(post.replies || []), reply]);
    const coll = announcement?.id === postId ? "meta" : "posts";
    const docId = announcement?.id === postId ? "announcement" : postId;
    try {
      await updateDoc(doc(db, coll, docId), { replies: updatedReplies });
      
      const today = getLocalDateString();
      const isNewDay = user.lastActionDate !== today;
      await handleUpdateUser({ 
        ...user, 
        commentsCount: (user.commentsCount || 0) + 1,
        dailyCommentsCount: (isNewDay ? 0 : (user.dailyCommentsCount || 0)) + 1,
        lastActionDate: today
      });
      const authorId = post.username;
      if (authorId && allUsers[authorId]) {
        const author = allUsers[authorId];
        await updateDoc(doc(db, "users", authorId), { maxCommentsReceived: Math.max(author.maxCommentsReceived || 0, updatedReplies.length) });
      }
    } catch (error) { showNotification("Failed to comment.", "error"); }
  };

  const handleDeleteReply = async (postId: string, replyId: string) => {
    if (!user) return;
    const post = posts.find(p => p.id === postId) || (announcement?.id === postId ? (announcement as any) : null);
    if (!post || !post.replies) return;
    
    const updatedReplies = post.replies.filter((r: any) => r.id !== replyId);
    const coll = announcement?.id === postId ? "meta" : "posts";
    const docId = announcement?.id === postId ? "announcement" : postId;
    
    try {
      await updateDoc(doc(db, coll, docId), { replies: sanitizeData(updatedReplies) });
    } catch (error) {
      showNotification("Failed to remove comment.", "error");
    }
  };

  const handleAuth = async (email: string, pass: string, isSignUp: boolean, username?: string, firstName?: string, lastName?: string) => {
    try {
      if (isSignUp) {
        if (!username || !firstName || !lastName) return "Username, First Name, and Last Name are required";
        const uHandle = username.trim();
        const fName = firstName.trim();
        const lName = lastName.trim();
        isCreatingAccount.current = true; // Set flag early to block onAuthStateChanged interference
        
        try {
          const taken = await isHandleTaken(db, uHandle);
          if (taken) {
            isCreatingAccount.current = false;
            return "Username taken";
          }
        } catch (checkErr: any) {
          console.error("Username check failed", checkErr);
        }
        
        let userCredential;
        try {
          userCredential = await createUserWithEmailAndPassword(auth, email, pass);
          try {
            await sendEmailVerification(userCredential.user);
          } catch (sendErr) {
            console.warn("Could not send verification email on signup:", sendErr);
          }
          setIsEmailVerified(false);
        } catch (authErr: any) {
          isCreatingAccount.current = false;
          if (authErr.code === 'auth/email-already-in-use') return "Email already in use";
          if (authErr.code === 'auth/weak-password') return "Password is too weak";
          if (authErr.code === 'auth/invalid-email') return "Invalid email format";
          return authErr.message;
        }

        try {
          // Create Firestore Doc IMMEDIATELY after auth creation
          const allUsersList = Object.values(allUsers) as UserProfile[];
          const lbId = getNewUserLeaderboardId(allUsersList);

          const newUser: UserProfile = { 
            id: userCredential.user.uid, 
            uid: userCredential.user.uid, 
            username: uHandle, 
            firstName: fName,
            lastName: lName,
            totalXP: 0, 
            availableXP: 0, 
            dailyXP: 0,
            monthlyXP: 0, 
            availableScrap: 0,
            joinedAt: Date.now(), 
            completedAchievements: [], 
            earnedTitles: [], 
            tags: [], 
            dailyEarnings: {}, 
            loginCount: 1, 
            friends: [], 
            friendRequests: [], 
            unlockedAssets: [],
            warningCount: 0,
            totalWarningsReceived: 0,
            permissions: { isVerified: false, isCreator: false, isTester: false, isModerator: false },
            appOpenCount: 1,
            hasSeenTutorial: false,
            leaderboardId: undefined,
            lastResetMonth: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date()),
            resetAccount: false,
            sparks: 0,
            audioEnabled: true,
            audioVolume: 0.5
          };
          
          await setDoc(doc(db, "users", uHandle), sanitizeData(newUser));
          
          // Update profile AFTER Firestore is ready
          await updateProfile(userCredential.user, { displayName: uHandle });
          await userCredential.user.getIdToken(true);
          
          sessionInitialized.current = true; 
          isCreatingAccount.current = false;
          setUser({ ...newUser, uid: userCredential.user.uid });
        } catch (fsErr: any) {
          console.error("Firestore user creation failed, cleaning up auth...", fsErr);
          try { await userCredential.user.delete(); } catch (delErr) { console.error("Failed to delete auth user after FS failure", delErr); }
          isCreatingAccount.current = false;
          if (fsErr.message?.includes('permissions')) return "Permission error creating profile. Please contact support.";
          return "Communication error with database. Please try again.";
        }
      } else {
        await signInWithEmailAndPassword(auth, email, pass);
      }
      setActiveTab('home'); 
      return null;
    } catch (error: any) { 
      isCreatingAccount.current = false; 
      if (error.code?.includes('user-not-found') || error.code?.includes('wrong-password') || error.code?.includes('invalid-credential')) return "Invalid credentials";
      return error.message; 
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Adding custom parameters can sometimes help with specific auth issues
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      const firebaseUser = result.user;
      
      console.log("Google Auth Success:", firebaseUser.email);
      const q = query(collection(db, "users"), where("uid", "==", firebaseUser.uid), limit(1));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        // New user from Google - need to assign a username
        const nameParts = (firebaseUser.displayName || '').trim().split(/\s+/);
        const gFirstName = nameParts[0] || 'Mender';
        const gLastName = nameParts.slice(1).join(' ') || '';
        const gFullName = firebaseUser.displayName || `${gFirstName} ${gLastName}`.trim();

        let baseUsername = gFullName || firebaseUser.email?.split('@')[0] || 'mender';
        let finalUsername = baseUsername;
        let counter = 1;
        
        // Check for collisions
        while ((await getDoc(doc(db, "users", finalUsername))).exists()) {
          finalUsername = `${baseUsername}${counter}`;
          counter++;
        }

        isCreatingAccount.current = true;
        const allUsersList = Object.values(allUsers) as UserProfile[];
        const lbId = getNewUserLeaderboardId(allUsersList);

          const newUser: UserProfile = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            username: finalUsername,
            firstName: gFirstName,
            lastName: gLastName,
            totalXP: 0,
            availableXP: 0,
            dailyXP: 0,
            monthlyXP: 0,
            availableScrap: 0,
            joinedAt: Date.now(),
            completedAchievements: [],
            earnedTitles: [],
            tags: [],
            dailyEarnings: {},
            loginCount: 1,
            friends: [],
            friendRequests: [],
            unlockedAssets: [],
            warningCount: 0,
            totalWarningsReceived: 0,
            permissions: { isVerified: false, isCreator: false, isTester: false, isModerator: false },
            appOpenCount: 1,
            hasSeenTutorial: false,
            leaderboardId: undefined,
            lastResetMonth: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date()),
            resetAccount: false,
            sparks: 0,
            audioEnabled: true,
            audioVolume: 0.5
          };
        
        await setDoc(doc(db, "users", finalUsername), sanitizeData(newUser));
        await updateProfile(firebaseUser, { displayName: finalUsername });
        await firebaseUser.getIdToken(true);
        
        sessionInitialized.current = true;
        isCreatingAccount.current = false;
        setUser({ ...newUser, uid: firebaseUser.uid });
      }
      setActiveTab('home');
      return null;
    } catch (error: any) {
      console.error("Google Auth Error Detail:", error);
      if (error.code === 'auth/internal-error') {
        return "Google Auth failed (Internal Error). Please ensure the current domain is allowlisted in Firebase Console.";
      }
      return error.message || "Unknown error during Google Auth.";
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return null;
    } catch (error: any) {
      console.error("Reset Password Error:", error);
      if (error.code === 'auth/user-not-found') return "No account found with this email.";
      if (error.code === 'auth/invalid-email') return "Invalid email address.";
      return error.message;
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !auth.currentUser) return;
    try {
      // 1. Delete Posts (Batch)
      const postsQ = query(collection(db, 'posts'), where('userId', '==', user.id), limit(500));
      const postsSnap = await getDocs(postsQ);
      const batch = writeBatch(db);
      postsSnap.forEach(doc => batch.delete(doc.ref));
      
      // 2. Delete Pins (Batch)
      const pinsQ = query(collection(db, 'pins'), where('userId', '==', user.id), limit(500));
      const pinsSnap = await getDocs(pinsQ);
      pinsSnap.forEach(doc => batch.delete(doc.ref));
      
      await batch.commit();

      // 3. Delete User Document
      await deleteDoc(doc(db, 'users', user.id));

      // 4. Delete Auth User
      await auth.currentUser.delete();
      
      // State will be cleared by onAuthStateChanged
    } catch (error) {
      console.error("Error deleting account:", error);
      showNotification("Failed to delete account.", "error");
    }
  };

  const handleLogout = async () => { await signOut(auth); setUser(null); setAllUsers({}); setPins([]); setPosts([]); setZones([]); setAnnouncement(null); sessionInitialized.current = false; };

  const handleCloseTutorial = (isFinished: boolean = true) => {
    if (user) {
      handleUpdateUser({
        ...user,
        hasSeenTutorial: isFinished ? true : user.hasSeenTutorial,
        tutorialStep: isFinished ? 0 : user.tutorialStep
      });
    }
    setShowTutorial(false);
  };

  const handleTutorialStepChange = (step: number) => {
    if (user) {
      handleUpdateUser({
        ...user,
        tutorialStep: step
      });
    }
  };

  const isCreator = user?.permissions?.isCreator || (user?.tags || []).includes('Creator');
  const isTester = user?.permissions?.isTester || (user?.tags || []).includes('Tester');
  useEffect(() => {
    if (user) {
      processGlobalLeaderboards().catch(console.error);
      processMonthlyReset().catch(console.error);
      if (user.teamId) {
        processDailyRewards(user.id, user.teamId).catch(console.error);
      }
    }
  }, [user]);

  const isModerator = user?.permissions?.isModerator || (user?.tags || []).includes('Moderator');
  const isCreatorOrTester = isCreator || isTester || isModerator;
  const isAdminPanelAccessible = isCreator || isModerator;

  const effectiveFeatures = React.useMemo(() => {
    const newFeatures: Record<string, boolean> = {};
    
    Object.keys(features).forEach(key => {
        const mode = features[key];
        if (mode === 'disabled') {
            newFeatures[key] = false;
        } else if (mode === 'admin') {
            newFeatures[key] = isCreatorOrTester;
        } else {
            newFeatures[key] = true;
        }
    });
    
    return newFeatures;
  }, [features, isCreatorOrTester]);

  useEffect(() => {
    const fullScreenTabs: TabType[] = ['admin', 'rewards', 'world_rankings', 'achievements'];
    setIsFullScreen(fullScreenTabs.includes(activeTab) || false);
  }, [activeTab]);

  const handleCheckEmailVerification = async (): Promise<boolean> => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      const verified = auth.currentUser.emailVerified;
      setIsEmailVerified(verified);
      if (verified) {
        showNotification("Email verified successfully! Welcome to LitterLooker.", "info");
        if (user && !user.hasSeenTutorial) {
          setShowTutorial(true);
        }
      }
      return verified;
    }
    return false;
  };

  const handleResendVerificationEmail = async (): Promise<string | null> => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        return null;
      } catch (err: any) {
        if (err.code === 'auth/too-many-requests') {
          return "Too many requests. Please wait a moment before trying again.";
        }
        return err.message || "Failed to resend verification email.";
      }
    }
    return "No user account found.";
  };

  const isCurrentlyBlocked = user?.blockedUntil && user.blockedUntil > Date.now();
  const isTrulyLockedDown = isLockedDown && user && !(isCreator || isTester || isModerator);

  if (isTrulyLockedDown) {
    return <LockdownScreen lockdownReason={lockdownReason} onLogout={handleLogout} />;
  }

  if (appError) {
    return <ErrorScreen error={appError} onReset={() => window.location.reload()} />;
  }

  return (
    <MotionConfig reducedMotion={user?.lowPowerModeEnabled ? "always" : "never"}>
      <AnimatePresence>
        {isLoadingAuth && <LoadingAuth key="loading" isLowPower={!!user?.lowPowerModeEnabled} />}
      </AnimatePresence>

      <AnimatePresence>
        {loadingFeature && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] bg-gray-950/65 backdrop-blur-md flex items-center justify-center pointer-events-auto select-none overflow-hidden"
          >
            <div className="flex flex-col items-center gap-3">
              <span className="text-emerald-500 dark:text-emerald-400 font-black text-xs tracking-widest animate-pulse">
                Loading {loadingFeature}
              </span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div inert={isLoadingAuth || loadingFeature ? true : undefined}>
      {(
        !user ? (
          authInitialized ? <AuthScreen onAuth={handleAuth} onGoogleAuth={handleGoogleAuth} onResetPassword={handleResetPassword} /> : null
        ) : auth.currentUser && !isEmailVerified ? (
          <EmailVerificationScreen
            email={auth.currentUser.email || ''}
            onResendEmail={handleResendVerificationEmail}
            onCheckVerification={handleCheckEmailVerification}
            onSignOut={async () => {
              await signOut(auth);
              setUser(null);
              setIsEmailVerified(true);
            }}
            onShowNotification={showNotification}
          />
        ) : isCurrentlyBlocked && !user.isAdmin ? (
          <BlockedScreen user={user} onLogout={handleLogout} />
        ) : (
    <div className={`flex flex-col h-screen w-full overflow-hidden relative transition-colors duration-500 bg-white dark:bg-[#111827] ${isLockedDown ? 'border-8 border-red-600' : ''}`}>
      <div className="flex flex-col h-full bg-transparent relative z-10">
      <BackgroundBlobs />
      {user && !user.hasSeenTutorial && user.tutorialStep !== undefined && user.tutorialStep >= 0 && activeTab !== 'home' && (
        <ResumeTutorialBar onResume={() => setActiveTab('home')} />
      )}
      {showTutorial && <TutorialOverlay onClose={handleCloseTutorial} onNavigate={(tab) => setActiveTab(tab)} initialStep={user.tutorialStep || 0} onStepChange={handleTutorialStepChange} />}
      {currentNotification && <NotificationToast {...currentNotification} onClose={() => setCurrentNotification(null)} />}
      {scrapGain && <ScrapGainBox amount={scrapGain} onClose={() => setScrapGain(null)} />}
      {levelUpRank && <LevelUpOverlay rank={levelUpRank} onClose={() => setLevelUpRank(null)} />}
      
      {showSanctionWarning && (
        <ConfirmModal title="Educational Warning" message={showSanctionWarning} confirmText="I Understand" onConfirm={() => setShowSanctionWarning(null)} onCancel={() => setShowSanctionWarning(null)} isDestructive={false} />
      )}

      {!isFullScreen && (
        <header className="bg-primary dark:bg-[#023020] shrink-0 z-50 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] relative pt-[max(0px,env(safe-area-inset-top))]">
          <div className="w-full h-full px-2 sm:px-6 py-1.5 flex items-center justify-between">
            <div className="cursor-pointer z-10 h-14 sm:h-16 flex items-center justify-center active:scale-95 transition-all" onClick={() => setActiveTab('home')}>
              <img src="/Graphics/Icon.png?v=2" alt="LitterLooker" className="h-full w-auto object-contain drop-shadow-md" />
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end gap-0 whitespace-nowrap">
                  <div className="flex items-center gap-1 cursor-pointer" onClick={() => setActiveTab('profile')}><Username user={user} className="text-[12px]" />{user.permissions?.isVerified && <VerifiedBadge size={10} />}</div>
                  {user.selectedTitle && <div className="leading-none"><TitleDisplay title={user.selectedTitle} size="md" /></div>}
                  <button onClick={() => setViewingRankPathUser(user)} className="flex items-center gap-1 font-black text-[10px] uppercase tracking-tighter text-secondary leading-none">
                    <div className="w-4 h-4 rounded-full overflow-hidden shrink-0">
                      <img src={getRankIconPath(getRankInfo(user.totalXP).name)} alt="" className="w-full h-full object-contain" />
                    </div>
                    <span>« {getRankInfo(user.totalXP).name} »</span>
                  </button>
                </div>
                <button onClick={() => setActiveTab('profile')} className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 shadow-md bg-gray-200 shrink-0">{user.profilePicture ? <img src={user.profilePicture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><User size={20} /></div>}</button>
              </div>
              <button onClick={handleLogout} className="text-white p-2 hover:bg-white/10 rounded-full transition-all ml-1"><LogOut size={20} /></button>
            </div>
          </div>
        </header>
      )}

      <main className={`w-full flex-1 bg-transparent relative z-10 ${
        ['profile', 'achievements', 'crews', 'rewards', 'admin'].includes(activeTab) 
          ? 'overflow-hidden h-full' 
          : 'overflow-y-auto hide-scrollbar'
      } ${!isFullScreen ? 'pb-28 sm:pb-32' : ''}`}>
        {activeTab === 'home' && (
          <HomePage 
            user={user} 
            allUsers={visibleUsersMap} 
            onShowRankPath={() => setViewingRankPathUser(user)} 
            onShowWorldRankings={() => setActiveTab('world_rankings')}
            missedPins={visiblePins.filter(p => p.userId !== user.id && p.timestamp > lastSeen && !dismissedMissedIds.includes(p.id))} 
            missedCleanups={visibleCleanups.filter(c => c.creatorId !== user.id && c.timestamp > lastSeen && !dismissedMissedIds.includes(c.id))}
            missedPosts={visiblePosts.filter(p => p.userId !== user.id && p.timestamp > lastSeen && !dismissedMissedIds.includes(p.id))} 
            missedAnnouncement={[]} 
            onJumpToPin={(id) => { setFocusPinId(id); setActiveTab('map'); }} 
            onJumpToFeed={() => setActiveTab('community')} 
            onDismissMissed={(id) => {
              setDismissedMissedIds(prev => [...prev, id]);
              if (id.startsWith('crew_invite_')) {
                const teamId = id.replace('crew_invite_', '');
                const notif = (user.crewInvites || []).find(i => i.teamId === teamId);
                // We need the notification ID to mark it as read in Firestore
                // But we don't have it here easily. 
                // Actually, we can query for it or just rely on the fact that 
                // CleanupCrewsPage will still show it if it's in user.crewInvites.
                // The user said "Even if a user has been invited to a crew but they click away, 
                // the crew card should be visible in the explore for crews section for the one week."
                // This implies that "clicking away" (dismissing) SHOULD NOT remove it from the explore list.
                // My current implementation already does this because it stays in user.crewInvites.
              }
            }} 
            dismissedMissedIds={dismissedMissedIds}
            onViewAchievements={() => setActiveTab('achievements')} 
            onViewRewards={() => setActiveTab('rewards')} 
            onViewCleanupCrews={(teamId) => { setSelectedCrewId(teamId); setActiveTab('crews'); }}
            onClaimLeaderboardReward={() => { if(user.pendingLeaderboardReward) { const amt = handleAwardScrap(user.pendingLeaderboardReward.reward, true); handleUpdateUser(recordDailyScrap({...user, pendingLeaderboardReward: null}, amt, true)); } }} 
            onViewFriends={() => setActiveTab('profile')} 
            onInviteFriend={handleInviteFriend}
            onCheckWelcomeBack={() => {}} 
            onClearAllMissed={() => setDismissedMissedIds(prev => Array.from(new Set([
              ...prev, 
              ...visiblePins.map(p => p.id), 
              ...visiblePosts.map(p => p.id), 
              ...visibleCleanups.map(c => c.id),
              ...(user.friendRequests || []).map(r => `friend_${r.fromUserId}`),
              ...(user.crewInvites || []).map(i => `crew_invite_${i.teamId}`),
              'lb_reward'
            ])))} 
            activeZone={activeZone} 
            features={effectiveFeatures}
            globalSettings={globalSettings}
            onAnswerDailyQuestion={async (history, timeLeft) => {
              await updateDoc(doc(db, "users", user.id), {
                currentChallengeHistory: history,
                currentChallengeTimeLeft: timeLeft
              });
            }}
            onEndChallenge={onCompleteDailyChallenge}
            onUseSpark={onUseSpark}
            onSetFullScreen={setIsFullScreen}
          />
        )}
        
        <div className={activeTab === 'map' ? 'block' : 'hidden'}>
          <MapPage 
            user={user} 
            allUsers={visibleUsersMap} 
            pins={visiblePins} 
            onAddPin={async (p) => {
              const isAdmin = user.isAdmin || user.permissions?.isModerator;
              const finalPin = { 
                ...p, 
                userId: auth.currentUser?.uid || p.userId, 
                type: 'pin',
                verified: isAdmin ? true : !!p.verified
              };
              
              const saveToOfflineQueue = (pinToSave: any) => {
                const pendingStr = localStorage.getItem('pendingPins');
                const pending = pendingStr ? JSON.parse(pendingStr) : [];
                pending.push(pinToSave);
                localStorage.setItem('pendingPins', JSON.stringify(pending));
                setPins((prev: any) => [{ ...pinToSave, isPendingOffline: true }, ...prev].sort((a, b) => b.timestamp - a.timestamp));
                showNotification("Saved to local storage. Will sync when reconnected.", "warning");
              };

              try {
                if (!navigator.onLine) {
                  saveToOfflineQueue(finalPin);
                } else {
                  setPins((prev: any) => {
                    if (prev.some((existing: any) => existing.id === finalPin.id)) return prev;
                    return [finalPin, ...prev].sort((a, b) => b.timestamp - a.timestamp);
                  });
                  await setDoc(doc(db, "pins", p.id), sanitizeData(finalPin));
                }
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                  navigator.vibrate([100, 50, 100]);
                }
                audioService.playSuccess();
                
                const today = getLocalDateString();
                const isNewDay = user.lastActionDate !== today;
                handleUpdateUser({
                  ...user,
                  dailyPinsCount: (isNewDay ? 0 : (user.dailyPinsCount || 0)) + 1,
                  lastActionDate: today
                });
              } catch (e) {
                console.error("Failed to add pin:", e);
                saveToOfflineQueue(finalPin);
              }
            }} 
            onDeletePin={async (id) => {
              try {
                const pendingStr = localStorage.getItem('pendingPins');
                if (pendingStr) {
                  let pending = JSON.parse(pendingStr);
                  const initLen = pending.length;
                  pending = pending.filter((p: any) => p.id !== id);
                  if (pending.length < initLen) {
                    localStorage.setItem('pendingPins', JSON.stringify(pending));
                    setPins((prev: any) => prev.filter((p: any) => p.id !== id));
                  }
                }
              } catch(e) {}
              try {
                await deleteDoc(doc(db, "pins", id));
              } catch(e: any) {
                console.error("Failed to delete pin from db:", e);
                showNotification(`Failed to delete pin from database: ${e.message}`, "error");
              }
            }} 
            focusPinId={focusPinId} 
            setFocusPinId={setFocusPinId} 
            onViewProfile={(id) => setViewingProfileId(id)} 
            onShowNotification={showNotification} 
            isImageDuplicate={() => false} 
            isLockedDown={isLockedDown} 
            onRetrySync={syncPendingData}
            onPinAction={(wasCleared, contributors) => { if(wasCleared) { audioService.playClean(); const amt = handleAwardScrap(350); const updated = recordDailyScrap(user, amt); handleUpdateUser({ ...updated, clearedPinsCount: (updated.clearedPinsCount || 0) + 1, pinsSubmittedCount: (updated.pinsSubmittedCount || 0) + 1 }); if (contributors && contributors.length > 0) handleTagUsers(contributors, amt); } }} 
            onUpdateUser={handleUpdateUser} 
            onUpdateAllUsers={setAllUsers}
            onAddProgress={async (pid, r) => { 
              const saveProgressToOfflineQueue = (pidToSave: string, reportToSave: any) => {
                const pendingStr = localStorage.getItem('pendingProgress');
                const pending = pendingStr ? JSON.parse(pendingStr) : [];
                pending.push({ pid: pidToSave, r: reportToSave });
                localStorage.setItem('pendingProgress', JSON.stringify(pending));
                
                // Optimistically update pins state to show the report immediately
                setPins((prev: any) => prev.map((p: any) => {
                  if (p.id === pidToSave) {
                    return { ...p, progressReports: [...(p.progressReports || []), { ...reportToSave, isPendingOffline: true }] };
                  }
                  return p;
                }));
                showNotification("Progress saved to local storage. Will sync when reconnected.", "warning");
              };

              try {
                if (!navigator.onLine) {
                  saveProgressToOfflineQueue(pid, r);
                  return;
                }
                console.log("onAddProgress called for pin:", pid, "report:", r.id);
                const p = pins.find(x => x.id === pid); 
                if (!p) {
                  console.error("Pin not found in state:", pid);
                  return;
                }

                let estimatedStats = null;
                try {
                  if (r.mediaUrls && r.mediaUrls.length > 0) {
                    estimatedStats = await estimateLitterStats(r.mediaUrls);
                  } else if (r.mediaUrl) {
                    estimatedStats = await estimateLitterStats([r.mediaUrl]);
                  }
                } catch (aiErr) {
                  console.warn("AI Estimation failed, continuing without stats:", aiErr);
                }

                const reportWithStats = estimatedStats ? { ...r, litterStats: estimatedStats } : r;
                const sanitizedReport = sanitizeData(reportWithStats);
                
                // 1. Save to separate collection (avoids 1MB limit)
                await setDoc(doc(db, "progressReports", r.id), { ...sanitizedReport, pinId: pid });
                console.log("Saved report to progressReports collection");

                // 2. Update pin's reports array (keeping it for now for UI compatibility)
                const updatedReports = sanitizeData([...(p.progressReports || []), sanitizedReport]); 
                await updateDoc(doc(db, "pins", pid), { progressReports: updatedReports }); 
                console.log("Updated pin with new report");

                if (estimatedStats) {
                  const newUserStats = {
                    weightKg: (user.litterStats?.weightKg || 0) + estimatedStats.weightKg,
                    areaSqM: (user.litterStats?.areaSqM || 0) + estimatedStats.areaSqM,
                    piecesCount: (user.litterStats?.piecesCount || 0) + estimatedStats.piecesCount
                  };
                  
                  const historyEntry = { ...estimatedStats, timestamp: Date.now() };
                  const newUserHistory = [...(user.litterStatsHistory || []), historyEntry];
                  
                  if (globalSettings) {
                    const newGlobalStats = {
                      weightKg: (globalSettings.totalLitterStats?.weightKg || 0) + estimatedStats.weightKg,
                      areaSqM: (globalSettings.totalLitterStats?.areaSqM || 0) + estimatedStats.areaSqM,
                      piecesCount: (globalSettings.totalLitterStats?.piecesCount || 0) + estimatedStats.piecesCount
                    };
                    const newGlobalHistory = [...(globalSettings.totalLitterStatsHistory || []), historyEntry];
                    await updateDoc(doc(db, "meta", "globalSettings"), { 
                      totalLitterStats: newGlobalStats,
                      totalLitterStatsHistory: newGlobalHistory
                    });
                  }

                  if (user.teamId) {
                    try {
                      const teamRef = doc(db, "teams", user.teamId);
                      const teamSnap = await getDoc(teamRef);
                      if (teamSnap.exists()) {
                        const teamData = teamSnap.data() as Team;
                        const newTeamStats = {
                          weightKg: (teamData.litterStats?.weightKg || 0) + estimatedStats.weightKg,
                          areaSqM: (teamData.litterStats?.areaSqM || 0) + estimatedStats.areaSqM,
                          piecesCount: (teamData.litterStats?.piecesCount || 0) + estimatedStats.piecesCount
                        };
                        const newTeamTotalArea = (teamData.totalArea || 0) + estimatedStats.areaSqM;
                        const newTeamDailyArea = (teamData.dailyArea || 0) + estimatedStats.areaSqM;
                        const newTeamHistory = [...(teamData.litterStatsHistory || []), historyEntry];
                        await updateDoc(teamRef, {
                          litterStats: newTeamStats,
                          totalArea: newTeamTotalArea,
                          dailyArea: newTeamDailyArea,
                          litterStatsHistory: newTeamHistory
                        });
                      }
                    } catch (teamErr) {
                      console.error("Failed to update team stats:", teamErr);
                    }
                  }
                }

                const isVerified = allUsers[p?.username || '']?.permissions?.isVerified; 
                const amt = handleAwardScrap(250 * (isVerified ? 2 : 1)); 
                
                let finalUser = recordDailyScrap(user, amt);
                if (estimatedStats) {
                  finalUser = {
                    ...finalUser,
                    litterStats: {
                      weightKg: (finalUser.litterStats?.weightKg || 0) + estimatedStats.weightKg,
                      areaSqM: (finalUser.litterStats?.areaSqM || 0) + estimatedStats.areaSqM,
                      piecesCount: (finalUser.litterStats?.piecesCount || 0) + estimatedStats.piecesCount
                    },
                    litterStatsHistory: [...(finalUser.litterStatsHistory || []), { ...estimatedStats, timestamp: Date.now() }]
                  };
                }

                if (r.taggedUsernames && r.taggedUsernames.length > 0) {
                  handleTagUsers(r.taggedUsernames, amt);
                }

                await handleUpdateUser({ ...finalUser, multiplierReportsCount: (user.multiplierReportsCount || 0) + (activeZone ? 1 : 0) }); 
              } catch (err) {
                console.error("Error adding progress report:", err);
                saveProgressToOfflineQueue(pid, r);
              }
            }} 
            onUpdatePinUrgency={async (id, u) => {
              try {
                await updateDoc(doc(db, "pins", id), { urgency: u });
              } catch (err: any) {
                handleFirestoreError(err, OperationType.UPDATE, `pins/${id}`);
              }
            }} 
            onUpdatePinIntensity={async (id, intensity) => {
              try {
                await updateDoc(doc(db, "pins", id), { intensity });
              } catch (err: any) {
                handleFirestoreError(err, OperationType.UPDATE, `pins/${id}`);
              }
            }} 
            userLocation={userLocation} 
            zones={zones} 
            isVisible={activeTab === 'map'} 
            groupCleanups={visibleCleanups}
            onAddGroupCleanup={async (c) => {
              try {
                // Use "pins" collection because it has permissive rules
                await setDoc(doc(db, "pins", c.id), sanitizeData({ ...c, type: 'cleanup' }));
                
                // Send notifications to invited users
                for (const username of (c.invitedUsernames || [])) {
                  const targetUser = allUsers[username];
                  // Ensure users do not get activity notifications about things that they themselves did
                  if (targetUser && targetUser.id !== user.id) {
                    try {
                      await setDoc(doc(collection(db, "notifications")), {
                        targetUserId: targetUser.id,
                        message: `@${user.username} invited you to a group cleanup!`,
                        timestamp: Date.now(),
                        read: false
                      });
                    } catch (notifErr) {
                      console.warn("Could not send notification (restricted):", notifErr);
                    }
                  }
                }
              } catch (err: any) {
                console.error("Firestore Write Error (Cleanups):", err);
                throw err;
              }
            }}
            features={effectiveFeatures}
          />
        </div>

        {activeTab === 'leaderboard' && <LeaderboardPage user={user} allUsers={visibleUsersMap} onViewProfile={(id) => setViewingProfileId(id)} onClaim={() => { if(user.pendingLeaderboardReward) { const amt = handleAwardScrap(user.pendingLeaderboardReward.reward, true); handleUpdateUser(recordDailyScrap({...user, pendingLeaderboardReward: null}, amt, true)); } }} features={effectiveFeatures} userLocation={userLocation} pins={pins} posts={posts} />}
        {activeTab === 'achievements' && <AchievementsPage user={user} allUsers={allUsers} onBack={() => setActiveTab('home')} />}
        {activeTab === 'profile' && <ProfilePage user={user} onUpdateUser={handleUpdateUser} onBack={() => setActiveTab('home')} onShowRankPath={() => setViewingRankPathUser(user)} onShowWorldRankings={() => setActiveTab('world_rankings')} onViewFriends={() => {}} allUsers={allUsers} onSendRequest={handleSendFriendRequest} onAcceptRequest={handleAcceptFriendRequest} onDeclineRequest={handleDeclineFriendRequest} onRemoveFriend={handleRemoveFriend} onViewProfile={(id) => setViewingProfileId(id)} onNavigateToAdmin={() => setActiveTab('admin')} onDeleteAccount={handleDeleteAccount} onInviteFriend={handleInviteFriend} features={effectiveFeatures} setIsCameraActive={setIsCameraActive} onSetFullScreen={setIsFullScreen} />}
        {activeTab === 'world_rankings' && <WorldRankingsPage user={user} onBack={() => setActiveTab('home')} onViewProfile={(id) => setViewingProfileId(id)} features={effectiveFeatures} />}
        {activeTab === 'community' && <CommunityPage user={user} allUsers={visibleUsersMap} posts={visiblePosts} onAddPost={async (p) => { 
          try {
            await setDoc(doc(db, "posts", p.id), sanitizeData(p)); 
            if (p.taggedUsernames?.length) handleTagUsers(p.taggedUsernames); 
            handleUpdateUser({ ...user, postsCount: (user.postsCount || 0) + 1 });
          } catch (err: any) {
            handleFirestoreError(err, OperationType.CREATE, `posts/${p.id}`);
          }
        }} onDeletePost={async (id) => { 
          try {
            await deleteDoc(doc(db, "posts", id));
          } catch (err: any) {
            handleFirestoreError(err, OperationType.DELETE, `posts/${id}`);
          }
        }} pins={visiblePins} onViewPin={(id) => { setFocusPinId(id); setActiveTab('map'); }} onViewProfile={(id) => setViewingProfileId(id)} onShowNotification={showNotification} isImageDuplicate={() => false} isLockedDown={isLockedDown} announcement={announcement} onAnnounceReaction={(emoji) => handleToggleReaction(announcement!.id, emoji)} onAnnounceReply={(text) => handleAddReply(announcement!.id, text)} onUpdateUser={handleUpdateUser} onUpdateAllUsers={setAllUsers} onToggleReaction={handleToggleReaction} onAddReply={handleAddReply} onDeleteReply={handleDeleteReply} features={effectiveFeatures} globalSettings={globalSettings} onNavigateToCrews={() => setActiveTab('crews')} userLocation={userLocation} />}
        {activeTab === 'crews' && <CleanupCrewsPage user={user} allUsers={allUsers} onUpdateUser={handleUpdateUser} onBack={() => { setSelectedCrewId(undefined); setActiveTab('home'); }} onShowNotification={showNotification} onViewProfile={(id) => setViewingProfileId(id)} features={effectiveFeatures} pins={pins} groupCleanups={visibleCleanups} onViewPin={(id) => { setFocusPinId(id); setActiveTab('map'); }} initialTeamId={selectedCrewId || user.teamId} />}
        {activeTab === 'rewards' && user && <RewardsPage user={user} features={features} onBack={() => setActiveTab('home')} onUpdateUser={handleUpdateUser} />}
        {activeTab === 'admin' && isAdminPanelAccessible && (
          <AdminDashboard 
            user={user}
            announcement={announcement}
            isLockedDown={isLockedDown}
            isAdminPanelValid={isAdminPanelValid}
            isModPanelValid={isModPanelValid}
            lockdownReason={lockdownReason}
            pins={pins}
            allUsers={allUsers}
            onBack={() => setActiveTab('profile')}
            onShowNotification={showNotification}
            zones={zones}
            groupCleanups={groupCleanups}
            posts={posts}
            features={features}
            globalSettings={globalSettings}
            isModeratorOnly={isModerator && !isCreator}
          />
        )}
      </main>

      {!isFullScreen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none bg-gradient-to-t from-gray-50/50 dark:from-gray-900/50 to-transparent">
          <div className="w-full">
            {isCameraActive && (
              <div className="bg-red-600/90 text-white text-[10px] font-black uppercase tracking-[0.2em] py-2 text-center backdrop-blur-sm pointer-events-auto border-t border-white/10 animate-pulse">
                <span className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
                  Camera in use
                </span>
              </div>
            )}
            {!isOnline && (
              <div className="bg-gray-500/90 text-white text-[10px] font-black uppercase tracking-[0.2em] py-2 text-center backdrop-blur-sm pointer-events-auto border-t border-white/10">
                Currently Offline
              </div>
            )}
            <nav className="bg-white/95 dark:bg-[#0a0f18]/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 flex justify-around p-2 pb-3 pointer-events-auto shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
              <button onClick={() => { audioService.playPop(); setActiveTab('home'); }} className={`flex flex-col items-center justify-center gap-1.5 px-6 py-1.5 rounded-2xl transition-all duration-200 active:scale-100 hover:scale-105 ${activeTab === 'home' ? 'text-primary bg-primary/10 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
                <div className="w-7 h-7 flex items-center justify-center overflow-hidden">
                  <img src={ICONS.HOME} className="w-full h-full object-cover" style={{ transform: 'scale(1.8)' }} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Home</span>
              </button>
              <button onClick={() => { audioService.playPop(); setActiveTab('map'); }} className={`flex flex-col items-center justify-center gap-1.5 px-6 py-1.5 rounded-2xl transition-all duration-200 active:scale-100 hover:scale-105 ${activeTab === 'map' ? 'text-primary bg-primary/10 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
                <div className="w-7 h-7 flex items-center justify-center overflow-hidden">
                  <img src={ICONS.MAP} className="w-full h-full object-cover" style={{ transform: 'scale(1.25)' }} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Map</span>
              </button>
              <button onClick={() => { audioService.playPop(); setActiveTab('leaderboard'); }} className={`flex flex-col items-center justify-center gap-1.5 px-6 py-1.5 rounded-2xl transition-all duration-200 active:scale-100 hover:scale-105 ${activeTab === 'leaderboard' ? 'text-primary bg-primary/10 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
                <div className="w-7 h-7 flex items-center justify-center overflow-hidden">
                  <img src={ICONS.LEADERBOARD} className="w-full h-full object-cover" style={{ transform: 'scale(1.25)' }} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Rank</span>
              </button>
              <button onClick={() => { audioService.playPop(); setActiveTab('community'); }} className={`flex flex-col items-center justify-center gap-1.5 px-6 py-1.5 rounded-2xl transition-all duration-200 active:scale-100 hover:scale-105 ${activeTab === 'community' ? 'text-primary bg-primary/10 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
                <div className="w-7 h-7 flex items-center justify-center overflow-hidden">
                  <img src={ICONS.COMMUNITY} className="w-full h-full object-cover" style={{ transform: 'scale(1.25)' }} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Feed</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {showWarningPopup && (
        <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-[40px] p-10 shadow-2xl w-full max-w-md border dark:border-gray-700 animate-pop-in text-center flex flex-col items-center gap-6">
            <div className="bg-red-100 dark:bg-red-900/30 p-6 rounded-full">
              <AlertCircle className="text-red-500" size={64} strokeWidth={2.5} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tighter leading-none">Warning Received!</h2>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest opacity-60">Violation of Community Guidelines</p>
            </div>

            {warningReason && warningReason !== 'No reason provided.' && (
              <div className="w-full bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-6 border border-gray-100 dark:border-gray-700">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Reason</p>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-200 italic">"{warningReason}"</p>
              </div>
            )}

            <p className="text-xs font-bold text-gray-400 leading-relaxed px-4">
              Repeated violations may lead to a permanent ban. Please review our community standards to keep LitterLooker a safe place for everyone.
            </p>

            <button 
              onClick={() => {
                auth.signOut();
                window.location.reload();
              }}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-5 rounded-2xl uppercase text-sm tracking-[0.2em] shadow-xl shadow-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <LogOut size={20} /> Log Off App
            </button>
          </div>
        </div>
      )}

      {viewingProfileId && <ViewProfileModal userId={viewingProfileId} currentUser={user} allUsers={allUsers} onClose={() => setViewingProfileId(null)} onShowRankPath={(u) => setViewingRankPathUser(u)} onSendRequest={handleSendFriendRequest} onBlockUser={handleBlockUser} onReportUser={handleReportUser} onShowNotification={showNotification} />}
      {viewingRankPathUser && <RankPathModal user={viewingRankPathUser} onClose={() => setViewingRankPathUser(null)} />}
      </div>
    </div>
        )
      )}
      </div>
    </MotionConfig>
  );
}; export default App;