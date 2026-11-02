import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, User, Camera, Award, ChevronDown, Save, Palette, Paintbrush, Zap, Lock, Pipette, RefreshCw, Search, UserPlus, UserCheck, Clock, Check, X, Users, ArrowRight, UserMinus, ShieldAlert, Key, Loader2, RefreshCcw, ShieldCheck, Ban, AlertCircle, AlertTriangle, Trophy, Sparkles, Download, Share2, QrCode, Scan } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { Volume2, VolumeX } from 'lucide-react';
import { audioService } from '../services/audioService';
import { UserProfile } from '../types';
import { RANK_SYSTEM, AssetReward, ACHIEVEMENTS_DATA, TITLE_RARITY_MAP, INFINITY_XP, INFINITY_SYMBOL } from '../constants';
import { getRankInfo, hashPassword, sanitizeData, calculateCredibilityScore, convertWeight, convertArea, getWeightUnit, getAreaUnit, compressImage, useIsDarkMode, getUserFullName, getUserFirstName, isHandleTaken } from '../utils';
import { Username } from './Username';
import { TermsModal } from './TermsModal';
import { TagBadge } from './TagBadge';
import { VerifiedBadge } from './VerifiedBadge';
import { LitterStatsGraph } from './LitterStatsGraph';
import { ImpactCard } from './ImpactCard';
import { db, auth, OperationType, handleFirestoreError } from '../services/firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, query, where, getDocs, writeBatch, limit } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';

export const ProfilePage: React.FC<{ 
  user: UserProfile; 
  onUpdateUser: (u: UserProfile) => Promise<void>; 
  onBack: () => void; 
  onShowRankPath: () => void;
  onShowWorldRankings: () => void;
  onViewFriends: () => void;
  allUsers: Record<string, UserProfile>;
  onSendRequest: (targetId: string) => void;
  onAcceptRequest: (targetId: string) => void;
  onDeclineRequest: (targetId: string) => void;
  onRemoveFriend: (friendId: string) => void;
  onViewProfile: (userId: string) => void;
  onNavigateToAdmin?: () => void;
  onDeleteAccount?: () => Promise<void>;
  onInviteFriend?: () => void;
  features: Record<string, boolean>;
  setIsCameraActive?: (active: boolean) => void;
  onSetFullScreen?: (full: boolean) => void;
}> = ({ user, onUpdateUser, onBack, onShowRankPath, onShowWorldRankings, onViewFriends, allUsers, onSendRequest, onAcceptRequest, onDeclineRequest, onRemoveFriend, onViewProfile, onNavigateToAdmin, onDeleteAccount, onInviteFriend, features, setIsCameraActive, onSetFullScreen }) => {
  const isDarkMode = useIsDarkMode();
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'customize' | 'security' | 'buddies' | 'blocked'>('profile');
  const [profilePic, setProfilePic] = useState<string | null>(user.profilePicture || null);
  const [squaredProfilePic, setSquaredProfilePic] = useState<string>('');

  // Image cropper state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setIsDragging(true);
    setDragStart({ x: clientX - offsetX, y: clientY - offsetY });
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setOffsetX(clientX - dragStart.x);
    setOffsetY(clientY - dragStart.y);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleCropSave = () => {
    if (!cropSrc) return;
    const img = new Image();
    img.src = cropSrc;
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const size = 300;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        const viewportSize = 288;
        const imgAspect = img.naturalWidth / img.naturalHeight;
        
        let w_img = viewportSize;
        let h_img = viewportSize;
        
        if (imgAspect > 1) {
          w_img = viewportSize;
          h_img = viewportSize / imgAspect;
        } else {
          h_img = viewportSize;
          w_img = viewportSize * imgAspect;
        }

        const w_rendered = w_img * zoom;
        const h_rendered = h_img * zoom;

        const topLeftX = (viewportSize - w_rendered) / 2 + offsetX;
        const topLeftY = (viewportSize - h_rendered) / 2 + offsetY;

        const scaleToOutput = size / viewportSize;

        const destX = topLeftX * scaleToOutput;
        const destY = topLeftY * scaleToOutput;
        const destW = w_rendered * scaleToOutput;
        const destH = h_rendered * scaleToOutput;

        ctx.drawImage(
          img,
          destX,
          destY,
          destW,
          destH
        );

        const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        const compressed = await compressImage(croppedBase64, 300, 300, 0.7);
        setProfilePic(compressed);
        setCropSrc(null);
      }
    };
  };

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [showFullscreenQR, setShowFullscreenQR] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const currentRank = useMemo(() => getRankInfo(user.totalXP), [user.totalXP]);
  const isMaxLevel = useMemo(() => currentRank.level >= 15 || user.totalXP === INFINITY_XP, [currentRank, user.totalXP]);

  // Sync full screen state
  useEffect(() => {
    onSetFullScreen?.(showFullscreenQR || isScanning);
  }, [showFullscreenQR, isScanning, onSetFullScreen]);

  useEffect(() => {
    if (user.profilePicture) {
      compressImage(user.profilePicture, 256, 256, 0.8, true).then(setSquaredProfilePic);
    } else {
      setSquaredProfilePic(null);
    }
  }, [user.profilePicture]);

  const [username, setUsername] = useState(user.username || '');
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const hasCreatedName = !!(user.firstName || user.lastName);
  const [description, setDescription] = useState(user.description || '');
  const [selectedTitle, setSelectedTitle] = useState(user.selectedTitle || '');
  const [mendingBuddySearch, setMendingBuddySearch] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isAdminVerifying, setIsAdminVerifying] = useState(false);
  const [adminError, setAdminError] = useState(false);
  const [visibility, setVisibility] = useState<'active' | 'inactive'>(user.visibility || 'active');
  const [allowFriendRequests, setAllowFriendRequests] = useState(user.allowFriendRequests !== false);
  const [lowPowerModeEnabled, setLowPowerModeEnabled] = useState<boolean>(!!user.lowPowerModeEnabled);
  const [usernameShine, setUsernameShine] = useState<boolean>(!!user.usernameShine);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [measurementSystem, setMeasurementSystem] = useState<'metric' | 'imperial'>(user.measurementSystem || 'metric');
  const [mapRadiusFilter, setMapRadiusFilter] = useState<number>(user.mapRadiusFilter || 100);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(user.audioEnabled !== false);
  const [audioVolume, setAudioVolume] = useState<number>(typeof user.audioVolume === 'number' ? user.audioVolume : 0.5);
  const [bgMusicEnabled, setBgMusicEnabled] = useState<boolean>(user.bgMusicEnabled === true);
  const [bgMusicVolume, setBgMusicVolume] = useState<number>(typeof user.bgMusicVolume === 'number' ? user.bgMusicVolume : 0.3);
  const [isResetting, setIsResetting] = useState(false);
  const [isBuddyCardExpanded, setIsBuddyCardExpanded] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const html5QrCodeRef = useRef<any>(null);

  // Safety cleanup for camera active state
  useEffect(() => {
    return () => {
      setIsCameraActive?.(false);
    };
  }, [setIsCameraActive]);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        // Ensure the element exists and is empty
        const container = document.getElementById("qr-reader");
        if (!container) return;
        container.innerHTML = ""; 

        html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCodeRef.current = html5QrCode;
        setIsCameraActive?.(true);

        const videoConstraints = {
          facingMode: facingMode,
          width: { ideal: 640, max: 640 },
          height: { ideal: 480, max: 480 }
        };

        const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
        
        await html5QrCode.start(
          videoConstraints, 
          config,
          (decodedText: string) => {
            let targetId = '';
            if (decodedText.startsWith('buddy:')) {
              targetId = decodedText.split(':')[1];
            } else if (decodedText.includes('?buddy=')) {
              try {
                const url = new URL(decodedText);
                targetId = url.searchParams.get('buddy') || '';
              } catch (e) {
                console.error("Invalid URL in QR code", e);
              }
            }

            if (targetId) {
              if (targetId === user.id) {
                setScanError("You cannot add yourself as a buddy!");
                return;
              }
              onSendRequest(targetId);
              setIsScanning(false);
            } else {
              setScanError("Invalid QR Code for Mending Buddies.");
            }
          },
          () => {} // silent scan errors
        );
      } catch (err: any) {
        console.error("Unable to start scanning", err);
        setScanError(`Camera error: ${err}`);
        setIsCameraActive?.(false);
      }
    };

    if (isScanning) {
      startScanner();
    }

    return () => {
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().then(() => {
            html5QrCode?.clear();
            setIsCameraActive?.(false);
          }).catch(err => console.error("Failed to stop scanner", err));
        } else {
          setIsCameraActive?.(false);
        }
      }
    };
  }, [isScanning, facingMode, user.id, onSendRequest, setIsCameraActive]);

  const toggleCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
      } catch (err) {
        console.error("Error toggling camera", err);
      }
    } else {
      setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    }
  };

  const [publicSettings, setPublicSettings] = useState(user.publicProfileSettings || {
    showTotalXP: true,
    showAchievements: true,
    showRank: true,
    showBuddies: true
  });
  const [showPublicSettings, setShowPublicSettings] = useState(false);
  const [pushSettings, setPushSettings] = useState(user.pushNotificationSettings || {
    friendInvites: true,
    teamMessages: true,
    teamEvents: true,
    leaderboardUpdates: true,
    mentions: true
  });
  const [showPushSettings, setShowPushSettings] = useState(false);
  const [showImpactCard, setShowImpactCard] = useState(false);
  
  const [verifyModalAction, setVerifyModalAction] = useState<'reset' | 'delete' | null>(null);
  const [verifyUsername, setVerifyUsername] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const colors = [
    { id: 'uc_blue', name: 'Blue', color: '#3B82F6', lvl: 3 },
    { id: 'uc_purple', name: 'Purple', color: '#A855F7', lvl: 5 },
    { id: 'uc_red', name: 'Red', color: '#EF4444', lvl: 8 },
    { id: 'uc_gold', name: 'Gold', color: '#eab308', lvl: 10 },
  ];

  const gradients = [
    { id: 'ug_blue', name: 'Blue Gradient', colors: ['#3B82F6', '#1E40AF'], lvl: 5 },
    { id: 'ug_purple', name: 'Purple Gradient', colors: ['#a855f7', '#6b21a8'], lvl: 7 },
    { id: 'ug_red', name: 'Red Gradient', colors: ['#EF4444', '#B91C1C'], lvl: 10 },
    { id: 'ug_gold', name: 'Gold Gradient', colors: ['#ca8a04', '#facc15'], lvl: 13 },
  ];

  const [uColor, setUColor] = useState(user.usernameColor || '');
  const [uGradient, setUGradient] = useState<[string, string] | null>(user.usernameGradient || null);
  
  const [mixColor1, setMixColor1] = useState<string | null>(null);
  const [mixColor2, setMixColor2] = useState<string | null>(null);

  const levelInfo = getRankInfo(user.totalXP);
  const userLevel = levelInfo.level;

  const displayTags = useMemo(() => {
    const tags = (user.tags || []).filter(t => t !== 'Verified');
    if (user.permissions?.isCreator || (user.tags || []).includes('Creator')) tags.push('Creator');
    if (user.permissions?.isTester || (user.tags || []).includes('Tester')) tags.push('Tester');
    if (user.permissions?.isModerator || (user.tags || []).includes('Moderator')) tags.push('Moderator');
    return Array.from(new Set(tags));
  }, [user.tags, user.permissions]);

  const getRequirementText = (assetId: string) => {
    const rankEntry = RANK_SYSTEM.find(r => r.rewards?.some(reward => reward.id === assetId));
    if (rankEntry) return `LVL ${rankEntry.level}`;
    const achievement = ACHIEVEMENTS_DATA.find(a => a.givesAsset?.id === assetId);
    if (achievement) return achievement.title;
    return 'Locked';
  };

  const LockedOverlay: React.FC<{ requirement: string }> = ({ requirement }) => (
    <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center p-2 text-center">
      <div className="absolute top-1.5 right-1.5 text-white/90 drop-shadow-md">
        <Lock size={12} strokeWidth={3} />
      </div>
      <span className="text-[7px] font-black text-white uppercase tracking-wider leading-tight drop-shadow-md">Requires<br/>{requirement}</span>
    </div>
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleResetAccount = async () => {
    if (isResetting) return;
    setIsResetting(true);
    
    try {
      // Reset User Stats
      const updates: Partial<UserProfile> = {
        totalXP: 0,
        availableXP: 0,
        dailyXP: 0,
        monthlyXP: 0,
        completedAchievements: [],
        earnedTitles: [],
        unlockedAssets: [],
        selectedTitle: undefined,
        selectedProfileBorder: undefined,
        selectedPostBorder: undefined,
        selectedPinDesign: undefined,
        resetAccount: false,
        leaderboardId: undefined,
      };
      
      // Update local and parent state
      onUpdateUser({ ...user, ...updates });
      
    } catch (error) {
      console.error("Error resetting account:", error);
    } finally {
      setIsResetting(false);
    }
  };

  const handleVerifyAction = async () => {
    if (verifyUsername !== user.username) {
      setVerifyError("Username does not match.");
      return;
    }
    
    setIsVerifying(true);
    setVerifyError('');
    
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const hasPassword = currentUser.providerData.some(p => p.providerId === 'password');
        if (hasPassword) {
          if (!verifyPassword) {
            setVerifyError("Password is required.");
            setIsVerifying(false);
            return;
          }
          const credential = EmailAuthProvider.credential(currentUser.email!, verifyPassword);
          await reauthenticateWithCredential(currentUser, credential);
        }
      }
      
      // Proceed with action
      if (verifyModalAction === 'reset') {
        const updates = { resetAccount: true };
        onUpdateUser({ ...user, ...updates });
      } else if (verifyModalAction === 'delete') {
        if (onDeleteAccount) {
          await onDeleteAccount();
        }
      }
      
      setVerifyModalAction(null);
      setVerifyUsername('');
      setVerifyPassword('');
    } catch (error: any) {
      console.error("Verification failed:", error);
      setVerifyError("Authentication failed. Please check your password.");
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (user.resetAccount && !isResetting) {
      handleResetAccount();
    }
  }, [user.resetAccount]);

  const handleExportData = () => {
    const data = {
      profile: {
        username: user.username,
        description: user.description,
        totalXP: user.totalXP,
        joinedAt: user.joinedAt,
        litterStats: user.litterStats,
        achievements: user.completedAchievements,
        titles: user.earnedTitles,
      },
      statsHistory: user.litterStatsHistory || [],
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LitterLooker_Data_${user.username}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => { 
    setSaveError(null);
    const trimmedUsername = username.trim();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedUsername) {
      setSaveError("Username handle is required.");
      return;
    }

    const isInfiniteXP = user.totalXP === -1 || user.totalXP === INFINITY_XP;

    if (!isInfiniteXP && (!trimmedFirst || !trimmedLast)) {
      setSaveError("First and last name are required.");
      return;
    }

    setIsSaving(true);

    try {
      const isChangingHandle = trimmedUsername.toLowerCase() !== (user.username || '').trim().toLowerCase();

      if (isChangingHandle) {
        // 1. Check Level-up Handle Change limit
        const currentRank = getRankInfo(user.totalXP);
        const currentLevel = currentRank.level;
        const isMaxLevel = currentLevel >= 15 || isInfiniteXP;

        if (!isMaxLevel && user.lastHandleChangeLevel === currentLevel) {
          setSaveError(`You can only change your handle once per level-up. Level up to Level ${currentLevel + 1} to unlock another handle change!`);
          setIsSaving(false);
          return;
        }

        // 2. Check handle uniqueness
        const taken = await isHandleTaken(db, trimmedUsername, user.id, user.uid);
        if (taken) {
          setSaveError(`The handle "@${trimmedUsername}" is already taken by another user. Please choose a different handle.`);
          setIsSaving(false);
          return;
        }
      }

      const updates: Partial<UserProfile> = {
        username: trimmedUsername,
        firstName: hasCreatedName ? user.firstName : (trimmedFirst || undefined),
        lastName: hasCreatedName ? user.lastName : (trimmedLast || undefined),
        description: description.trim() || undefined,
        profilePicture: profilePic || undefined,
        selectedTitle: selectedTitle || undefined,
        selectedProfileBorder: undefined,
        selectedPostBorder: undefined,
        selectedPinDesign: undefined,
        usernameColor: uGradient ? undefined : (uColor || undefined),
        usernameGradient: uGradient ? uGradient : undefined,
        visibility: visibility,
        allowFriendRequests: allowFriendRequests,
        lowPowerModeEnabled: lowPowerModeEnabled,
        measurementSystem: measurementSystem,
        mapRadiusFilter: mapRadiusFilter,
        audioEnabled: audioEnabled,
        audioVolume: audioVolume,
        bgMusicEnabled: bgMusicEnabled,
        bgMusicVolume: bgMusicVolume,
        publicProfileSettings: publicSettings,
        pushNotificationSettings: pushSettings,
        usernameShine: usernameShine
      };

      if (isChangingHandle) {
        const currentLevel = getRankInfo(user.totalXP).level;
        updates.lastHandleChangeLevel = currentLevel;
        updates.usernameChangeCount = (user.usernameChangeCount || 0) + 1;
      }
      if (profilePic !== user.profilePicture) {
        updates.profilePictureChangeCount = (user.profilePictureChangeCount || 0) + 1;
      }

      const finalUser = { ...user, ...updates };
      await onUpdateUser(finalUser); 
      setIsSaving(false);
      onBack(); 
    } catch (err: any) {
      console.error("Error saving profile:", err);
      setSaveError(err.message || "Failed to save profile changes. Please check your connection and try again.");
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        // First re-authenticate the user using their current credentials
        const credential = EmailAuthProvider.credential(currentUser.email!, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        
        // Then proceed to update the password securely
        await updatePassword(currentUser, newPassword);
        setPasswordSuccess('Password successfully updated!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setPasswordError('No active authentication session found.');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPasswordError('Incorrect current password.');
      } else if (err.code === 'auth/too-many-requests') {
        setPasswordError('Too many unsuccessful attempts. Access to this account has been temporarily disabled. Please try again later.');
      } else if (err.code === 'auth/weak-password') {
        setPasswordError('The new password is too weak. Please use at least 6 characters.');
      } else if (err.code === 'auth/user-mismatch') {
        setPasswordError('Credentials mismatch. The entered credentials do not match the logged-in user.');
      } else if (err.code === 'auth/requires-recent-login') {
        setPasswordError('This action requires a recent login. Please log out and back in, then try again.');
      } else {
        const msg = err.message || '';
        if (msg.includes('wrong-password') || msg.includes('invalid-credential') || msg.includes('password is invalid')) {
          setPasswordError('Incorrect current password.');
        } else if (msg.includes('weak-password') || msg.includes('password must be')) {
          setPasswordError('The new password is too weak. Please use at least 6 characters.');
        } else {
          setPasswordError('Failed to update password. Please check your credentials and try again.');
        }
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleAdminAccess = async () => {
    if (isAdminVerifying) return;
    setIsAdminVerifying(true);
    setAdminError(false);

    const isModerator = user.permissions?.isModerator || (user.tags || []).includes('Moderator');
    const isCreator = user.permissions?.isCreator || (user.tags || []).includes('Creator');

    try {
      const securitySnap = await getDoc(doc(db, "meta", "security"));
      if (!securitySnap.exists()) {
        setAdminError(true);
      } else {
        const data = securitySnap.data();
        if (!data) {
          setAdminError(true);
          return;
        }

        const adminHash = data.adminKeyHash?.trim().toLowerCase();
        const moderatorHash = data.moderatorKeyHash?.trim().toLowerCase();
        const enteredHash = (await hashPassword(adminPassword.trim())).toLowerCase();
        
        console.log("Attempting login. Entered Hash:", enteredHash);
        
        let success = false;
        if (isCreator && adminHash && adminHash === enteredHash) {
          success = true;
          await updateDoc(doc(db, "meta", "security"), {
            admins: arrayUnion(user.id)
          });
        } 
        
        if (!success && isModerator && moderatorHash && moderatorHash === enteredHash) {
          success = true;
          await updateDoc(doc(db, "meta", "security"), {
            moderators: arrayUnion(user.id)
          });
        }

        if (success) {
          setShowAdminLogin(false);
          setAdminPassword('');
          
          // 3. Navigate
          onNavigateToAdmin?.();
        } else {
          console.error("Verification failed.", {
            enteredHash,
            expectedAdminHash: adminHash,
            expectedModeratorHash: moderatorHash,
            isCreator,
            isModerator
          });
          setAdminError(true);
          // Auto-reset error after 1.5s so they can try again with a fresh animation
          setTimeout(() => setAdminError(false), 1500);
        }
      }
    } catch (e) {
      console.error("Access verification error", e);
      setAdminError(true);
    } finally {
      setIsAdminVerifying(false);
    }
  };

  const applyMix = () => {
    if (mixColor1 && mixColor2) {
      setUGradient([mixColor1, mixColor2]);
      setUColor('');
    }
  };

  const userFriends = useMemo(() => {
    return (user.friends || []).map(id => allUsers[id]).filter(Boolean) as UserProfile[];
  }, [user.friends, allUsers]);

  const globalSearchResults = useMemo(() => {
    if (!mendingBuddySearch.trim()) return [];
    return (Object.values(allUsers) as UserProfile[])
      .filter(u => u.id !== user.id && u.username.toLowerCase().includes(mendingBuddySearch.toLowerCase()))
      .slice(0, 10);
  }, [allUsers, mendingBuddySearch, user.id]);

  const requests = user.friendRequests || [];

  const renderUserAction = (targetUser: UserProfile) => {
    const isFriend = (user.friends || []).includes(targetUser.id);
    const hasSentRequest = (targetUser.friendRequests || []).some(r => r.fromUserId === user.id);
    const hasReceivedRequest = (user.friendRequests || []).some(r => r.fromUserId === targetUser.id);

    if (isFriend) {
      return (
        <div className="flex items-center gap-1 text-green-500 font-black text-[10px] uppercase">
          <UserCheck size={14} /> Mending Buddy
        </div>
      );
    }

    if (hasSentRequest) {
      return (
        <div className="flex items-center gap-1 text-gray-400 font-black text-[10px] uppercase">
          <Clock size={14} /> Pending
        </div>
      );
    }

    if (hasReceivedRequest) {
      return (
        <button 
          onClick={() => onAcceptRequest(targetUser.id)}
          className="bg-primary text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-sm active:scale-95 transition-all"
        >
          Accept
        </button>
      );
    }

    if (targetUser.totalXP === -1) return null;
    if (targetUser.allowFriendRequests === false) return null;

    return (
      <button 
        onClick={() => onSendRequest(targetUser.id)}
        className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-[10px] font-black uppercase hover:bg-primary hover:text-white transition-all active:scale-95"
      >
        Add Mending Buddy
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      {verifyModalAction && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm bg-black/60">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 w-full max-w-sm border dark:border-gray-700 shadow-2xl animate-pop-in space-y-6">
            <div className="text-center space-y-2">
              <div className="bg-red-50 dark:bg-red-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 text-red-600">
                <ShieldAlert size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">
                {verifyModalAction === 'reset' ? 'Reset Account' : 'Delete Account'}
              </h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                {verifyModalAction === 'reset' 
                  ? 'This will reset all your XP and Scrap to zero, including monthly XP. Achievements will be rescanned.' 
                  : 'This will permanently delete your account and all associated data.'}
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text"
                  autoFocus
                  disabled={isVerifying}
                  className={`w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border text-sm font-bold outline-none transition-all ${verifyError && verifyError.includes('Username') ? 'border-red-500 animate-shake' : 'border-gray-100 dark:border-gray-700 focus:border-red-500'} disabled:opacity-50`}
                  placeholder="Confirm Name"
                  value={verifyUsername}
                  onChange={e => setVerifyUsername(e.target.value)}
                />
              </div>
              
              <div className="relative">
                <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="password"
                  disabled={isVerifying}
                  className={`w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border text-sm font-bold outline-none transition-all ${verifyError && !verifyError.includes('Username') ? 'border-red-500 animate-shake' : 'border-gray-100 dark:border-gray-700 focus:border-red-500'} disabled:opacity-50`}
                  placeholder="Password"
                  value={verifyPassword}
                  onChange={e => setVerifyPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyAction()}
                />
              </div>
              
              {verifyError && <p className="text-center text-[10px] font-black text-red-500 uppercase tracking-widest animate-fade-in">{verifyError}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={handleVerifyAction}
                disabled={isVerifying || !verifyUsername || !verifyPassword}
                className="w-full bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-red-600/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isVerifying ? <Loader2 className="animate-spin" size={14} /> : 'Confirm Action'}
              </button>
              <button 
                onClick={() => { setVerifyModalAction(null); setVerifyUsername(''); setVerifyPassword(''); setVerifyError(''); }}
                className="w-full py-4 text-gray-400 font-black text-[10px] uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdminLogin && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm bg-black/60">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 w-full max-w-sm border dark:border-gray-700 shadow-2xl animate-pop-in space-y-6">
            <div className="text-center space-y-2">
              <div className="bg-red-50 dark:bg-red-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 text-red-600">
                <Lock size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Security Access</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                Enter administrative credentials to continue.
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="relative">
                <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="password"
                  autoFocus
                  disabled={isAdminVerifying}
                  className={`w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border text-sm font-bold outline-none transition-all ${adminError ? 'border-red-500 animate-shake' : 'border-gray-100 dark:border-gray-700 focus:border-red-500'} disabled:opacity-50`}
                  placeholder="Admin Password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdminAccess()}
                />
              </div>
              {adminError && <p className="text-center text-[10px] font-black text-red-500 uppercase tracking-widest animate-fade-in">Invalid Password</p>}
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={handleAdminAccess}
                disabled={isAdminVerifying || !adminPassword}
                className="w-full bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-red-600/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAdminVerifying ? <Loader2 className="animate-spin" size={14} /> : 'Unlock Panel'}
              </button>
              <button 
                onClick={() => { setShowAdminLogin(false); setAdminPassword(''); setAdminError(false); }}
                className="w-full py-4 text-gray-400 font-black text-[10px] uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 bg-primary text-white shadow-sm flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition" type="button"><ArrowLeft size={20} /></button>
          <h2 className="font-bold text-lg">My Identity</h2>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="bg-white text-primary px-4 py-2 rounded-xl text-xs font-black uppercase shadow-lg active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50">
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
          <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      <AnimatePresence>
        {isSaving && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] bg-gray-950/65 backdrop-blur-md flex items-center justify-center pointer-events-auto select-none overflow-hidden"
          >
            <div className="flex flex-col items-center gap-3">
              <span className="text-emerald-500 dark:text-emerald-400 font-black text-xs tracking-widest uppercase animate-pulse">
                Saving Profile Changes
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

      {saveError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800/60 flex items-center justify-between gap-3 text-left shrink-0 animate-slide-down">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <p className="text-xs font-black uppercase text-red-700 dark:text-red-300 tracking-tight">Save Error</p>
              <p className="text-[10px] font-bold text-red-600 dark:text-red-400 mt-0.5">{saveError}</p>
            </div>
          </div>
          <button onClick={() => setSaveError(null)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
            <X size={16} />
          </button>
        </div>
      )}
      
      <div className="flex border-b dark:border-gray-800 shrink-0 overflow-x-auto scrollbar-none scroll-smooth">
        <button onClick={() => setActiveSubTab('profile')} className={`flex-1 min-w-[80px] py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'profile' ? 'border-b-4 border-primary text-primary' : 'text-gray-400'}`}>Profile</button>
        <button onClick={() => setActiveSubTab('customize')} className={`flex-1 min-w-[90px] py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'customize' ? 'border-b-4 border-primary text-primary' : 'text-gray-400'}`}>Customize</button>
        <button onClick={() => setActiveSubTab('security')} className={`flex-1 min-w-[80px] py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'security' ? 'border-b-4 border-primary text-primary' : 'text-gray-400'}`}>Security</button>
        <button onClick={() => setActiveSubTab('buddies')} className={`flex-1 min-w-[80px] py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'buddies' ? 'border-b-4 border-primary text-primary' : 'text-gray-400'}`}>Buddies</button>
        <button onClick={() => setActiveSubTab('blocked')} className={`flex-1 min-w-[80px] py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'blocked' ? 'border-b-4 border-primary text-primary' : 'text-gray-400'}`}>Blocked</button>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center gap-6 overflow-y-auto pb-10 hide-scrollbar">
        {showImpactCard && <ImpactCard user={user} onClose={() => setShowImpactCard(false)} />}
        {activeSubTab === 'profile' && (
          <div className="w-full max-w-2xl flex flex-col items-center gap-6">
            {user.totalXP !== -1 && typeof calculateCredibilityScore(user, Object.keys(allUsers).length, allUsers) === 'number' && (calculateCredibilityScore(user, Object.keys(allUsers).length, allUsers) as number) < 30 && (
              <div className="w-full max-w-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                <div>
                  <h4 className="text-xs font-black text-red-600 dark:text-red-400 uppercase">Credibility Warning</h4>
                  <p className="text-[10px] text-red-500 dark:text-red-300 mt-1 leading-relaxed">
                    Your credibility score is critically low ({calculateCredibilityScore(user, Object.keys(allUsers).length, allUsers)}). Please ensure your reports are accurate and you are positively contributing to the community.
                  </p>
                </div>
              </div>
            )}
            <div className="relative group">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative shrink-0 transition-all duration-300 border-4 border-gray-200 dark:border-gray-700">
                {profilePic ? <img src={profilePic} className="w-full h-full object-cover" /> : <User size={48} className="text-gray-400" />}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="absolute bottom-0 right-0 bg-primary text-white p-2.5 rounded-full shadow-lg border-2 border-white dark:border-[#0a0f18] z-10 hover:scale-110 transition-transform active:scale-95"
              >
                <Camera size={18} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={(e) => { 
                  const f = e.target.files?.[0]; 
                  if(f) { 
                    const r = new FileReader(); 
                    r.onloadend = () => {
                      const base64 = r.result as string;
                      setCropSrc(base64);
                      setZoom(1);
                      setOffsetX(0);
                      setOffsetY(0);
                    }; 
                    r.readAsDataURL(f); 
                  } 
                }} 
                className="hidden" 
                accept="image/*" 
              />
            </div>

            {(user.totalXP !== -1 && user.totalXP !== INFINITY_XP) && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-3.5 flex items-center gap-2.5 text-left w-full max-w-xs shadow-sm">
                <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-[9.5px] font-bold text-amber-800 dark:text-amber-200 leading-tight">
                  <span className="font-black uppercase tracking-wider block text-amber-700 dark:text-amber-300">Real Name & Photo Policy</span>
                  LitterLooker requires your authentic real name and a clear real photo of yourself.
                </p>
              </div>
            )}
            
            <div className="text-center w-full max-w-xs space-y-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                {(user.permissions?.isVerified || user.permissions?.isCreator || user.permissions?.isModerator || user.permissions?.isAdmin || user.isAdmin) && <VerifiedBadge size={20} />}
                {displayTags.map(t => <TagBadge key={t} tag={t} />)}
              </div>
              {user.teamId && (
                <div className="text-xs font-black text-primary uppercase tracking-widest mb-2">
                  {user.teamName}
                </div>
              )}

              <div>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 text-left px-1">Username Handle</label>
                    <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full pl-4 pr-4 py-3.5 rounded-2xl bg-gray-100 dark:bg-gray-800/50 text-gray-900 dark:text-white font-bold text-sm shadow-inner outline-none focus:ring-2 focus:ring-primary" />
                    {!isMaxLevel && user.lastHandleChangeLevel === currentRank.level ? (
                      <p className="text-[9px] text-left text-amber-600 dark:text-amber-400 font-bold mt-1 px-1">
                        Handle change used for Level {currentRank.level}. Level up to Level {currentRank.level + 1} to unlock another handle change.
                      </p>
                    ) : (
                      <p className="text-[9px] text-left text-gray-400 font-bold mt-1 px-1">
                        {isMaxLevel ? '★ Max Level: Unlimited handle changes!' : `1 handle change available for Level ${currentRank.level}.`}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 text-left px-1">First Name</label>
                      <input 
                        value={hasCreatedName ? user.firstName : firstName} 
                        onChange={(e) => !hasCreatedName && setFirstName(e.target.value)} 
                        placeholder="First Name" 
                        disabled={hasCreatedName}
                        className="w-full pl-4 pr-4 py-3.5 rounded-2xl bg-gray-100 dark:bg-gray-800/50 text-gray-900 dark:text-white font-bold text-sm shadow-inner outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-200/60 dark:disabled:bg-gray-800/80" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 text-left px-1">Last Name</label>
                      <input 
                        value={hasCreatedName ? user.lastName : lastName} 
                        onChange={(e) => !hasCreatedName && setLastName(e.target.value)} 
                        placeholder="Last Name" 
                        disabled={hasCreatedName}
                        className="w-full pl-4 pr-4 py-3.5 rounded-2xl bg-gray-100 dark:bg-gray-800/50 text-gray-900 dark:text-white font-bold text-sm shadow-inner outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-200/60 dark:disabled:bg-gray-800/80" 
                      />
                    </div>
                  </div>
                  {hasCreatedName ? (
                    <p className="text-[9px] text-left text-gray-400 font-bold mt-1 px-1">First and last name cannot be changed after profile creation.</p>
                  ) : (user.totalXP !== -1 && user.totalXP !== INFINITY_XP) && (
                    <p className="text-[9px] text-left text-amber-600 dark:text-amber-400 font-bold mt-1 px-1">First and last name are required.</p>
                  )}
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 text-left px-1">Bio (Max 30 Words)</label>
                    <textarea 
                      value={description} 
                      onChange={(e) => {
                        const words = e.target.value.trim().split(/\s+/);
                        if (words.length <= 30 || e.target.value.length < description.length) {
                          setDescription(e.target.value);
                        }
                      }}
                      className="w-full pl-4 pr-4 py-3.5 rounded-2xl bg-gray-100 dark:bg-gray-800/50 text-gray-900 dark:text-white font-bold text-sm shadow-inner outline-none focus:ring-2 focus:ring-primary resize-none"
                      rows={3}
                      placeholder="Tell us about yourself..."
                    />
                    <p className="text-[9px] text-right text-gray-400 font-bold mt-1">{description.trim() ? description.trim().split(/\s+/).length : 0}/30 Words</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 text-left px-1">Selected Title</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3.5 text-orange-400"><Award size={16} /></span>
                      <select value={selectedTitle} onChange={(e) => setSelectedTitle(e.target.value)} className="w-full pl-9 pr-4 py-3.5 rounded-2xl bg-gray-100 dark:bg-gray-800/50 text-gray-900 dark:text-white font-bold text-sm shadow-inner appearance-none outline-none focus:ring-2 focus:ring-primary">
                        <option value="" className="text-gray-900 dark:text-white">No Title Selected</option>
                        {user.earnedTitles?.map(title => {
                          const achievement = ACHIEVEMENTS_DATA.find(a => a.title === title);
                          const rarity = achievement?.rarity || TITLE_RARITY_MAP[title] || 'Common';
                          let colorClass = 'text-gray-900 dark:text-white';
                          if (rarity === 'Rare') colorClass = 'text-blue-500 font-bold';
                          if (rarity === 'Legendary') colorClass = 'text-yellow-500 font-black';
                          return (
                            <option key={title} value={title} className={colorClass}>{title}</option>
                          );
                        })}
                      </select>
                      <ChevronDown className="absolute right-4 top-4 text-gray-400 pointer-events-none" size={16} />
                    </div>
                  </div>

                    <div className="w-full pt-4 space-y-4">
                    </div>

                    <div className="w-full pt-4">
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
                        {user.totalXP !== INFINITY_XP && (
                          <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                            <div className="text-left">
                              <span className="block text-[10px] font-black text-gray-500 uppercase">Credibility Score</span>
                              <span className="text-[9px] text-gray-400 italic">Based on your activity and votes.</span>
                            </div>
                            <div className={`font-black text-primary ${calculateCredibilityScore(user, Object.keys(allUsers).length, allUsers) === 'No score yet' ? 'text-sm' : 'text-xl'}`}>
                              {calculateCredibilityScore(user, Object.keys(allUsers).length, allUsers)}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="text-left">
                          <span className="block text-[10px] font-black text-gray-500 uppercase">Visibility Status</span>
                          <span className="text-[9px] text-gray-400 italic">Inactive hides your online status.</span>
                        </div>
                        <button 
                          onClick={() => setVisibility(prev => prev === 'active' ? 'inactive' : 'active')}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors p-1 ${visibility === 'active' ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${visibility === 'active' ? 'translate-x-2.5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                        <div>
                          <span className="block text-[10px] font-black text-gray-500 uppercase">Allow Friend Requests</span>
                          <span className="text-[9px] text-gray-400 italic">Others can add you as a buddy.</span>
                        </div>
                        <button 
                          onClick={() => {
                            setAllowFriendRequests(prev => !prev);
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors p-1 ${allowFriendRequests ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allowFriendRequests ? 'translate-x-2.5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="text-left">
                          <span className="block text-[10px] font-black text-gray-500 uppercase">Low Power Mode</span>
                          <span className="text-[9px] text-gray-400 italic">Disable animations to save power</span>
                        </div>
                        <button 
                          onClick={() => {
                            setLowPowerModeEnabled(prev => !prev);
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors p-1 ${lowPowerModeEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${lowPowerModeEnabled ? 'translate-x-2.5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                        <div>
                          <span className="block text-[10px] font-black text-gray-500 uppercase">Measurement System</span>
                          <span className="text-[9px] text-gray-400 italic">Switch measurement modes</span>
                        </div>
                        <div 
                          className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border dark:border-gray-700"
                        >
                          <button 
                            className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${measurementSystem === 'metric' ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            onClick={(e) => { e.stopPropagation(); setMeasurementSystem('metric'); }}
                          >
                            Metric
                          </button>
                          <button 
                            className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${measurementSystem === 'imperial' ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            onClick={(e) => { e.stopPropagation(); setMeasurementSystem('imperial'); }}
                          >
                            Imperial
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pb-4 border-b border-gray-200 dark:border-gray-700 text-left">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="block text-[10px] font-black text-gray-500 uppercase">Local Area</span>
                            <span className="text-[9px] text-gray-400 italic">Filter posts and reports by distance from you</span>
                          </div>
                          <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full text-[10px] font-black">
                            {mapRadiusFilter} Miles
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-gray-400">2 mi</span>
                          <input 
                            type="range"
                            min="2"
                            max="100"
                            step="5"
                            value={mapRadiusFilter}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setMapRadiusFilter(val);
                            }}
                            className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                          />
                          <span className="text-[10px] font-black text-gray-400">100 mi</span>
                        </div>
                      </div>

                      {/* Sound Effects Toggle & Volume Slider */}
                      <div className="flex flex-col gap-3 pb-4 border-b border-gray-200 dark:border-gray-700 text-left">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="block text-[10px] font-black text-gray-500 uppercase">Sound Effects</span>
                            <span className="text-[9px] text-gray-400 italic">Toggle in-app clicks and notifications</span>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const nextVal = !audioEnabled;
                              setAudioEnabled(nextVal);
                              if (nextVal) {
                                setTimeout(() => {
                                  audioService.playClick();
                                }, 50);
                              }
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors p-1 ${audioEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${audioEnabled ? 'translate-x-2.5' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        {audioEnabled && (
                          <div className="flex flex-col gap-2 mt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-gray-400 italic">Sound Volume</span>
                              <span className="text-[9px] font-black text-primary uppercase">
                                {Math.round(audioVolume * 100)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAudioVolume(0);
                                  audioService.setVolume(0);
                                }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                              >
                                <VolumeX size={14} />
                              </button>
                              <input 
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={audioVolume}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setAudioVolume(val);
                                  audioService.setVolume(val);
                                }}
                                onMouseUp={() => {
                                  audioService.playClick();
                                }}
                                onTouchEnd={() => {
                                  audioService.playClick();
                                }}
                                className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const val = 1.0;
                                  setAudioVolume(val);
                                  audioService.setVolume(val);
                                  audioService.playClick();
                                }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                              >
                                <Volume2 size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Background Music Toggle & Volume Slider */}
                      <div className="flex flex-col gap-3 pb-4 border-b border-gray-200 dark:border-gray-700 text-left">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="block text-[10px] font-black text-gray-500 uppercase">Background Music</span>
                            <span className="text-[9px] text-gray-400 italic">Toggle ambient background music</span>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const nextVal = !bgMusicEnabled;
                              setBgMusicEnabled(nextVal);
                              audioService.setBgMusicEnabled(nextVal);
                              if (audioEnabled) {
                                setTimeout(() => {
                                  audioService.playClick();
                                }, 50);
                              }
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors p-1 ${bgMusicEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${bgMusicEnabled ? 'translate-x-2.5' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        {bgMusicEnabled && (
                          <div className="flex flex-col gap-2 mt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-gray-400 italic">Music Volume</span>
                              <span className="text-[9px] font-black text-primary uppercase">
                                {Math.round(bgMusicVolume * 100)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBgMusicVolume(0);
                                  audioService.setBgMusicVolume(0);
                                }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                              >
                                <VolumeX size={14} />
                              </button>
                              <input 
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={bgMusicVolume}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setBgMusicVolume(val);
                                  audioService.setBgMusicVolume(val);
                                }}
                                onMouseUp={() => {
                                  if (audioEnabled) audioService.playClick();
                                }}
                                onTouchEnd={() => {
                                  if (audioEnabled) audioService.playClick();
                                }}
                                className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const val = 1.0;
                                  setBgMusicVolume(val);
                                  audioService.setBgMusicVolume(val);
                                  if (audioEnabled) audioService.playClick();
                                }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                              >
                                <Volume2 size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <button 
                          onClick={() => setShowPublicSettings(!showPublicSettings)}
                          className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-primary transition-colors"
                        >
                          <span>Public Profile Settings</span>
                          <ChevronDown size={14} className={`transition-transform ${showPublicSettings ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showPublicSettings && (
                          <div className="mt-4 space-y-3 animate-slide-up">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Show Total XP</span>
                              <button 
                                onClick={() => {
                                  setPublicSettings(prev => ({ ...prev, showTotalXP: !prev.showTotalXP }));
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors p-1 ${publicSettings.showTotalXP ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${publicSettings.showTotalXP ? 'translate-x-2.5' : 'translate-x-0'}`} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Show Achievements</span>
                              <button 
                                onClick={() => {
                                  setPublicSettings(prev => ({ ...prev, showAchievements: !prev.showAchievements }));
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors p-1 ${publicSettings.showAchievements ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${publicSettings.showAchievements ? 'translate-x-2.5' : 'translate-x-0'}`} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Show Rank</span>
                              <button 
                                onClick={() => {
                                  setPublicSettings(prev => ({ ...prev, showRank: !prev.showRank }));
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors p-1 ${publicSettings.showRank ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${publicSettings.showRank ? 'translate-x-2.5' : 'translate-x-0'}`} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Show Buddies</span>
                              <button 
                                onClick={() => {
                                  setPublicSettings(prev => ({ ...prev, showBuddies: !prev.showBuddies }));
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors p-1 ${publicSettings.showBuddies ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${publicSettings.showBuddies ? 'translate-x-2.5' : 'translate-x-0'}`} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <button 
                          onClick={() => setShowPushSettings(!showPushSettings)}
                          className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-primary transition-colors"
                        >
                          <span>Push Notification Settings</span>
                          <ChevronDown size={14} className={`transition-transform ${showPushSettings ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showPushSettings && (
                          <div className="mt-4 space-y-3 animate-slide-up">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Friend Invites</span>
                              <button 
                                onClick={() => {
                                  setPushSettings(prev => ({ ...prev, friendInvites: !prev.friendInvites }));
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors p-1 ${pushSettings.friendInvites ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pushSettings.friendInvites ? 'translate-x-2.5' : 'translate-x-0'}`} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Crew Chat Messages</span>
                              <button 
                                onClick={() => {
                                  setPushSettings(prev => ({ ...prev, teamMessages: !prev.teamMessages }));
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors p-1 ${pushSettings.teamMessages ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pushSettings.teamMessages ? 'translate-x-2.5' : 'translate-x-0'}`} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Crew Events</span>
                              <button 
                                onClick={() => {
                                  setPushSettings(prev => ({ ...prev, teamEvents: !prev.teamEvents }));
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors p-1 ${pushSettings.teamEvents ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pushSettings.teamEvents ? 'translate-x-2.5' : 'translate-x-0'}`} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Leaderboard Updates</span>
                              <button 
                                onClick={() => {
                                  setPushSettings(prev => ({ ...prev, leaderboardUpdates: !prev.leaderboardUpdates }));
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors p-1 ${pushSettings.leaderboardUpdates ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pushSettings.leaderboardUpdates ? 'translate-x-2.5' : 'translate-x-0'}`} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Mentions</span>
                              <button 
                                onClick={() => {
                                  setPushSettings(prev => ({ ...prev, mentions: !prev.mentions }));
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors p-1 ${pushSettings.mentions ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pushSettings.mentions ? 'translate-x-2.5' : 'translate-x-0'}`} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-12 pb-6 space-y-4">
                <div className="grid grid-cols-3 gap-2 mb-8">
                  <button 
                    onClick={() => setShowImpactCard(true)}
                    className="flex flex-col items-center justify-center gap-2 p-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-95"
                  >
                    <Share2 size={18} className="text-gray-400" />
                    <span className="text-[7px] font-black uppercase tracking-widest text-gray-400">Share</span>
                  </button>
                  <button 
                    onClick={async () => {
                        await onUpdateUser({ ...user, tutorialStep: 0, hasSeenTutorial: false });
                        window.location.reload();
                    }}
                    className="flex flex-col items-center justify-center gap-2 p-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-95"
                  >
                    <RefreshCcw size={18} className="text-gray-400" />
                    <span className="text-[7px] font-black uppercase tracking-widest text-gray-400">Tutorial</span>
                  </button>
                  <button 
                    onClick={() => {
                        const data = JSON.stringify(user, null, 2);
                        const blob = new Blob([data], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `mending_earth_data_${user.id}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                    }}
                    className="flex flex-col items-center justify-center gap-2 p-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-95"
                  >
                    <Download size={18} className="text-gray-400" />
                    <span className="text-[7px] font-black uppercase tracking-widest text-gray-400">Export</span>
                  </button>
                </div>
                
                <button 
                  onClick={() => setShowTermsModal(true)}
                  className="w-full text-center text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-primary transition-colors py-1"
                >
                  Terms and Conditions
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'customize' && (
          <div className="w-full max-w-2xl space-y-10 pb-10">
            <div className="space-y-4">
               <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1"><Paintbrush size={14} className="text-gray-400" /> Name Customization</h3>
               <div className="bg-gray-50 dark:bg-[#0f172a] p-5 rounded-[2.5rem] border dark:border-gray-800 space-y-4 shadow-sm">
                  <div className="flex items-center justify-center py-4 border-b border-gray-200 dark:border-gray-700 mb-2">
                    <div className="text-2xl font-black">
                      <Username user={{ ...user, firstName: firstName || user.firstName, lastName: lastName || user.lastName, username: `${firstName || ''} ${lastName || ''}`.trim() || user.username, usernameColor: uGradient ? undefined : uColor, usernameGradient: uGradient || undefined }} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase mb-3 px-1 flex items-center gap-2"><Zap size={10} className="text-gray-400" /> Solid Colors</p>
                    <div className="grid grid-cols-5 gap-2">
                       <button onClick={() => { setUColor(''); setUGradient(null); }} className={`h-11 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 ${!uColor && !uGradient ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                         <span className="text-[7px] font-black uppercase">STD</span>
                       </button>
                       {colors.map(c => {
                         const isUnlocked = userLevel >= c.lvl;
                         return (
                          <button 
                            key={c.id}
                            title={!isUnlocked ? `Requires LVL ${c.lvl}` : c.name}
                            onClick={() => { if(isUnlocked) { setUColor(c.color); setUGradient(null); } }}
                            className={`h-11 rounded-xl border-2 transition-all relative flex items-center justify-center ${uColor === c.color ? 'border-white ring-2 ring-primary scale-105 shadow-md' : 'border-transparent'} ${!isUnlocked ? 'cursor-not-allowed' : ''}`}
                            style={{ backgroundColor: c.color }}
                          >
                            {!isUnlocked && <LockedOverlay requirement={getRequirementText(c.id)} />}
                          </button>
                         );
                       })}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase mb-3 px-1 flex items-center gap-2"><Zap size={10} className="text-gray-400" /> Preset Gradients</p>
                    <div className="grid grid-cols-2 gap-2">
                       {gradients.map(g => {
                         const isUnlocked = userLevel >= g.lvl;
                         return (
                          <button 
                            key={g.id}
                            title={!isUnlocked ? `Requires LVL ${g.lvl}` : g.name}
                            onClick={() => { if(isUnlocked) { setUGradient([g.colors[0], g.colors[1]]); setUColor(''); } }}
                            className={`h-11 rounded-xl border-2 transition-all relative flex items-center justify-center shadow-sm ${uGradient && uGradient[0] === g.colors[0] && uGradient[1] === g.colors[1] ? 'border-white ring-2 ring-primary scale-105' : 'border-transparent'} ${!isUnlocked ? 'cursor-not-allowed' : ''}`}
                            style={{ background: `linear-gradient(to right, ${g.colors[0]}, ${g.colors[1]})` }}
                          >
                            <span className="text-[8px] font-black uppercase text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{g.name}</span>
                            {!isUnlocked && <LockedOverlay requirement={getRequirementText(g.id)} />}
                          </button>
                         );
                       })}
                    </div>
                  </div>

                  <div className="pt-2 pb-1 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-2"><Sparkles size={12} className="text-gray-400" /> Shine Effect</p>
                      {user.totalXP >= 725000 || (user.unlockedAssets || []).includes('us_shine') ? (
                        <button 
                          onClick={() => onUpdateUser({ ...user, usernameShine: !user.usernameShine })}
                          className={`w-10 h-5 rounded-full transition-all relative p-0.5 ${user.usernameShine ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all transform ${user.usernameShine ? 'translate-x-2.5' : 'translate-x-0'}`} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                          <Lock size={8} className="text-gray-400" />
                          <span className="text-[8px] font-black text-gray-400 uppercase">Level 15</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-2"><Pipette size={12} className="text-gray-400" /> Gradient Mixer</p>
                      {mixColor1 && mixColor2 && (
                        <button onClick={applyMix} className="text-[8px] font-black bg-primary text-white px-3 py-1 rounded-full uppercase tracking-widest shadow-lg flex items-center gap-1.5 animate-bounce">
                          <RefreshCw size={10} /> Apply Mix
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex flex-col gap-2">
                        <span className="text-[8px] font-black text-gray-400 uppercase text-center">Start</span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {colors.map(c => {
                            const isUnlocked = userLevel >= c.lvl;
                            return (
                              <button 
                                key={`mix1-${c.id}`}
                                title={!isUnlocked ? `Requires LVL ${c.lvl}` : c.name}
                                onClick={() => isUnlocked && setMixColor1(c.color)}
                                className={`h-8 rounded-lg border-2 transition-all relative ${mixColor1 === c.color ? 'border-white ring-2 ring-primary scale-105' : 'border-transparent'} ${!isUnlocked ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
                                style={{ backgroundColor: c.color }}
                              >
                                {!isUnlocked && <Lock size={8} className="absolute inset-0 m-auto text-white" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col gap-2">
                        <span className="text-[8px] font-black text-gray-400 uppercase text-center">End</span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {colors.map(c => {
                            const isUnlocked = userLevel >= c.lvl;
                            return (
                              <button 
                                key={`mix2-${c.id}`}
                                title={!isUnlocked ? `Requires LVL ${c.lvl}` : c.name}
                                onClick={() => isUnlocked && setMixColor2(c.color)}
                                className={`h-8 rounded-lg border-2 transition-all relative ${mixColor2 === c.color ? 'border-white ring-2 ring-primary scale-105' : 'border-transparent'} ${!isUnlocked ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
                                style={{ backgroundColor: c.color }}
                              >
                                {!isUnlocked && <Lock size={8} className="absolute inset-0 m-auto text-white" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center gap-2">
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Mix Preview</span>
                      <div className="w-full h-4 rounded-full shadow-inner" style={{ background: mixColor1 && mixColor2 ? `linear-gradient(to right, ${mixColor1}, ${mixColor2})` : '#f3f4f6' }} />
                    </div>
                  </div>
               </div>
            </div>

          </div>
        )}

        {activeSubTab === 'security' && (
          <div className="w-full max-w-2xl space-y-8 animate-fade-in text-left">
            {/* Admin/Moderator Access */}
            {((user.permissions?.isCreator || (user.tags || []).includes('Creator')) || 
              (user.permissions?.isModerator || (user.tags || []).includes('Moderator'))) && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                  <ShieldCheck size={14} className="text-gray-400" /> Administrative Access
                </h3>
                <div className="bg-gray-50 dark:bg-[#0f172a] p-6 rounded-[2.5rem] border dark:border-gray-800 space-y-4 shadow-sm">
                  <p className="text-[10px] text-gray-400 leading-relaxed font-semibold">
                    As an authorized staff member, you can enter the administrative or moderation dashboard below to manage records and users.
                  </p>
                  {(user.permissions?.isCreator || (user.tags || []).includes('Creator')) && (
                    <button 
                      onClick={() => setShowAdminLogin(true)}
                      className="w-full bg-red-600/10 border-2 border-red-600/30 text-red-600 rounded-2xl py-4 flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] shadow-sm hover:bg-red-600 hover:text-white transition-all active:scale-95"
                    >
                      <ShieldAlert size={18} /> Enter Admin Panel
                    </button>
                  )}

                  {(user.permissions?.isModerator || (user.tags || []).includes('Moderator')) && !(user.permissions?.isCreator || (user.tags || []).includes('Creator')) && (
                    <button 
                      onClick={() => setShowAdminLogin(true)}
                      className="w-full bg-blue-600/10 border-2 border-blue-600/30 text-blue-600 rounded-2xl py-4 flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] shadow-sm hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                    >
                      <ShieldCheck size={18} /> Enter Moderation Panel
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Update Password Option with Reauthentication */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                <Key size={14} className="text-gray-400" /> Security Credentials
              </h3>
              
              <div className="bg-gray-50 dark:bg-[#0f172a] p-6 rounded-[2.5rem] border dark:border-gray-800 space-y-4 shadow-sm">
                <p className="text-[10px] text-gray-400 leading-relaxed font-semibold">
                  For your security, updating your account password requires re-authenticating by entering your current password below.
                </p>

                {passwordError && (
                  <div className="p-3 bg-red-100 border border-red-200 text-red-600 rounded-2xl text-[11px] font-bold">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="p-3 bg-green-100 border border-green-200 text-green-600 rounded-2xl text-[11px] font-bold">
                    {passwordSuccess}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase mb-1.5 px-1 font-bold">Current Password</label>
                    <input 
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-4 pr-10 py-3.5 rounded-2xl bg-white dark:bg-gray-900 border dark:border-gray-800 outline-none text-sm focus:ring-2 focus:ring-primary font-bold text-gray-900 dark:text-white"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase mb-1.5 px-1 font-bold">New Password (Min 6 chars)</label>
                    <input 
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-4 pr-10 py-3.5 rounded-2xl bg-white dark:bg-gray-900 border dark:border-gray-800 outline-none text-sm focus:ring-2 focus:ring-primary font-bold text-gray-900 dark:text-white"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase mb-1.5 px-1 font-bold">Confirm New Password</label>
                    <input 
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full pl-4 pr-10 py-3.5 rounded-2xl bg-white dark:bg-gray-900 border dark:border-gray-800 outline-none text-sm focus:ring-2 focus:ring-primary font-bold text-gray-900 dark:text-white"
                      placeholder="••••••••"
                    />
                  </div>

                  <button 
                    onClick={handleUpdatePassword}
                    disabled={isUpdatingPassword}
                    className="w-full bg-primary text-white py-4 font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-primary/25 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isUpdatingPassword ? (
                      <>
                        <Loader2 className="animate-spin text-white" size={14} /> Re-authenticating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Danger zone actions */}
            <div className="space-y-4">
              <div className="bg-red-500/5 dark:bg-red-950/10 border border-red-500/15 p-6 rounded-[2.5rem] space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-start border-b dark:border-gray-800 pb-3">
                    <div>
                      <span className="block text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-wide">Reset Career Stats</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">Instantly wipes your unlocked cosmetics, and returns XP to zero.</span>
                    </div>
                    <button 
                      onClick={() => setVerifyModalAction('reset')}
                      className="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all"
                    >
                      Reset App
                    </button>
                  </div>
                  <div className="flex justify-between items-start pt-2">
                    <div>
                      <span className="block text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-wide font-bold font-black">Permanently Delete Account</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">Irreversibly deletes your profile completely from the database.</span>
                    </div>
                    <button 
                      onClick={() => setVerifyModalAction('delete')}
                      className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md"
                    >
                      Delete Profile
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'buddies' && (
          <div className="w-full max-w-2xl space-y-8 animate-fade-in">
            {isScanning && (
              <div className="fixed inset-0 z-[200] flex flex-col pt-24 items-center justify-start p-6 bg-white dark:bg-gray-950 animate-fade-in">
                <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-[3rem] p-6 shadow-2xl border dark:border-gray-800 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2.5 rounded-2xl text-primary"><Scan size={20} /></div>
                      <h3 className="font-black text-sm uppercase tracking-widest text-gray-800 dark:text-white">Scanner Active</h3>
                    </div>
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={toggleCamera}
                        className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 hover:text-primary transition-all"
                        title="Flip Camera"
                      >
                        <RefreshCw size={20} />
                      </button>
                      <button onClick={() => { setIsScanning(false); setIsCameraActive?.(false); }} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 hover:text-red-500 transition-all"><X size={20} /></button>
                    </div>
                  </div>
                  
                  <div id="qr-reader" className="w-full aspect-square mx-auto overflow-hidden rounded-3xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex justify-center items-center bg-black [&>div]:!w-full [&>div]:!h-full [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover [&_canvas]:!hidden"></div>
                  
                  {scanError && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-500 text-[10px] font-bold uppercase tracking-widest text-center rounded-2xl animate-shake">
                      {scanError}
                    </div>
                  )}

                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Position the QR code within the frame</p>
                  </div>
                </div>
              </div>
            )}

            {/* Buddy Card (QR Code) */}
            <div className={`bg-white dark:bg-gray-800/50 rounded-[2.5rem] border dark:border-gray-700 shadow-xl overflow-hidden transition-all duration-500 ${isBuddyCardExpanded ? 'p-6 space-y-6' : 'p-4 space-y-0'}`}>
              <div className="flex items-center justify-between w-full cursor-pointer" onClick={() => setIsBuddyCardExpanded(!isBuddyCardExpanded)}>
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2.5 rounded-2xl text-primary"><QrCode size={20} /></div>
                  <h3 className="font-black text-sm uppercase tracking-widest text-gray-800 dark:text-white">Buddy Identity</h3>
                </div>
                <div className={`text-gray-400 transition-transform duration-300 ${isBuddyCardExpanded ? 'rotate-180' : ''}`}>
                  <ChevronDown size={20} />
                </div>
              </div>

              {isBuddyCardExpanded && (
                <div className="flex flex-col items-center space-y-6 animate-fade-in">
                  <div 
                    className="bg-green-50 p-4 rounded-3xl shadow-inner border-2 border-gray-100 dark:border-gray-700 cursor-zoom-in active:scale-95 transition-transform"
                    onClick={() => setShowFullscreenQR(true)}
                  >
                    <QRCodeSVG 
                      value={`${window.location.origin}?buddy=${user.id}`}
                      size={160}
                      level="H"
                      bgColor="#F0FDF4"
                      fgColor="#166534"
                      includeMargin={false}
                      imageSettings={(squaredProfilePic || user.profilePicture) ? {
                        src: squaredProfilePic || user.profilePicture || '',
                        x: undefined,
                        y: undefined,
                        height: 36,
                        width: 36,
                        excavate: true,
                      } : undefined}
                    />
                  </div>

                  <div className="text-center space-y-1">
                    <p className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none">
                      <Username user={user} />
                    </p>
                    {((user.firstName || user.lastName) || user.totalXP !== -1) && (
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {(`${user.firstName || ''} ${user.lastName || ''}`.trim()) || getUserFullName(user)}
                      </p>
                    )}
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Scan or share to add buddies
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full">
                    <button 
                      onClick={() => setIsScanning(true)}
                      className="bg-gray-100 dark:bg-gray-800 text-gray-500 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all active:scale-95"
                    >
                      <Scan size={16} /> Scan
                    </button>
                    <button 
                      onClick={onInviteFriend}
                      className="bg-gray-100 dark:bg-gray-800 text-gray-500 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all active:scale-95"
                    >
                      <Share2 size={16} /> Share
                    </button>
                  </div>
                </div>
              )}
            </div>

            {requests.length > 0 && !mendingBuddySearch && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] px-2 flex items-center gap-2">
                  <Clock size={12} className="text-gray-400" /> Pending Requests ({requests.length})
                </h3>
                <div className="space-y-3">
                  {requests.map(req => {
                    const sender = allUsers[req.fromUserId];
                    return (
                      <div key={req.fromUserId} className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-md border dark:border-gray-700 flex items-center justify-between animate-slide-up">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile(req.fromUserId)}>
                          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-gray-100 border dark:border-gray-700">
                            {sender?.profilePicture ? <img src={sender.profilePicture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><User size={20} /></div>}
                          </div>
                          <div>
                            <div className="font-black text-sm text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                              <span className="flex items-center gap-0.5">
                                <span>@</span>
                                <Username user={sender || { username: req.fromUsername, id: req.fromUserId, totalXP: 0, availableXP: 0, joinedAt: 0 }} />
                              </span>
                              {(sender?.permissions?.isVerified || sender?.permissions?.isCreator || sender?.permissions?.isModerator || sender?.permissions?.isAdmin || sender?.isAdmin) && <VerifiedBadge size={14} />}
                            </div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">Wants to be mending buddies</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => onAcceptRequest(req.fromUserId)} className="bg-primary text-white p-2 rounded-xl shadow-md hover:scale-105 transition-all"><Check size={18} /></button>
                          <button onClick={() => onDeclineRequest(req.fromUserId)} className="bg-gray-100 dark:bg-gray-700 text-gray-400 p-2 rounded-xl shadow-sm hover:scale-105 transition-all"><X size={18} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                  <Search size={14} /> Discovery
                </h3>
                <button 
                  onClick={onInviteFriend}
                  className="px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-primary/20 transition-colors active:scale-95"
                >
                  <UserPlus size={12} /> Invite Friends
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-100 dark:bg-gray-800/50 text-gray-900 dark:text-white font-bold text-sm shadow-inner outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Search usernames..."
                  value={mendingBuddySearch}
                  onChange={e => setMendingBuddySearch(e.target.value)}
                />
              </div>
              
              {mendingBuddySearch.trim() && (
                <div className="space-y-3">
                  {globalSearchResults.length === 0 ? (
                    <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-[2rem] border border-dashed dark:border-gray-700">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No menders found.</p>
                    </div>
                  ) : (
                    globalSearchResults.map(sUser => (
                      <div key={sUser.id} className="bg-white dark:bg-gray-800 p-4 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between group transition-all hover:shadow-md animate-fade-in">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile(sUser.id)}>
                          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                            {sUser.profilePicture ? <img src={sUser.profilePicture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><User size={20} /></div>}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                               <Username user={sUser} className="text-sm" />
                               {(sUser.permissions?.isVerified || sUser.permissions?.isCreator || sUser.permissions?.isModerator || sUser.permissions?.isAdmin || sUser.isAdmin) && <VerifiedBadge size={12} />}
                            </div>
                            <span className="text-[9px] font-black text-primary uppercase">{sUser.totalXP === INFINITY_XP ? INFINITY_SYMBOL : sUser.totalXP.toLocaleString()} XP</span>
                          </div>
                        </div>
                        {renderUserAction(sUser)}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {!mendingBuddySearch && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] px-2 flex items-center gap-2">
                  <UserCheck size={12} className="text-gray-400" /> Your Friends ({userFriends.length})
                </h3>

                <div className="space-y-3 pb-8">
                  {userFriends.length === 0 ? (
                    <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-[2rem] border border-dashed dark:border-gray-700 opacity-50">
                      <UserMinus className="mx-auto mb-2 text-gray-300" size={40} />
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        No mending buddies yet.
                      </p>
                    </div>
                  ) : (
                    userFriends.map(friend => (
                      <div key={friend.id} className="bg-white dark:bg-gray-800 p-4 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between group transition-all hover:shadow-md">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile(friend.id)}>
                          <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                            {friend.profilePicture ? <img src={friend.profilePicture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><User size={24} /></div>}
                          </div>
                          <div>
                            <div className="font-black text-sm text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                              <span className="flex items-center gap-0.5">
                                <span>@</span>
                                <Username user={friend} />
                              </span>
                              {(friend.permissions?.isVerified || friend.permissions?.isCreator || friend.permissions?.isModerator || friend.permissions?.isAdmin || friend.isAdmin) && <VerifiedBadge size={14} />}
                            </div>
                            <p className="text-[10px] font-bold text-primary uppercase">{friend.totalXP === INFINITY_XP ? INFINITY_SYMBOL : friend.totalXP.toLocaleString()} XP</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => onRemoveFriend(friend.id)}
                          className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <UserMinus size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'blocked' && (
          <div className="w-full max-w-2xl space-y-4 animate-fade-in">
             <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] px-2 flex items-center gap-2">
                <Ban size={12} className="text-gray-400" /> Blocked Users ({user.blockedUsers?.length || 0})
             </h3>
             <div className="space-y-3">
                {(user.blockedUsers || []).length === 0 ? (
                    <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-[2rem] border border-dashed dark:border-gray-700 opacity-50">
                      <Ban className="mx-auto mb-2 text-gray-300" size={40} />
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No blocked users.</p>
                    </div>
                ) : (
                    (user.blockedUsers || []).map(blockedId => {
                        const blockedUser = allUsers[blockedId];
                        return (
                            <div key={blockedId} className="bg-white dark:bg-gray-800 p-4 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-700">
                                        {blockedUser?.profilePicture ? <img src={blockedUser.profilePicture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><User size={20} /></div>}
                                    </div>
                                    <div>
                                        <p className="font-black text-sm text-gray-800 dark:text-gray-100">@{blockedUser?.username || blockedId}</p>
                                        <p className="text-[9px] font-bold text-red-400 uppercase">Blocked</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => {
                                        const updated = { ...user, blockedUsers: (user.blockedUsers || []).filter(id => id !== blockedId) };
                                        onUpdateUser(updated);
                                    }}
                                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-xl text-[10px] font-black uppercase hover:bg-green-50 hover:text-green-600 transition-all"
                                >
                                    Unblock
                                </button>
                            </div>
                        );
                    })
                )}
             </div>
          </div>
        )}
      </div>
      {/* Fullscreen QR Modal */}
      {showFullscreenQR && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl" onClick={() => setShowFullscreenQR(false)} />
          <div className="relative w-full max-w-lg bg-green-50 dark:bg-gray-900 rounded-[3rem] p-8 shadow-2xl flex flex-col items-center animate-pop-in border border-gray-100 dark:border-gray-800">
            <button 
              onClick={() => setShowFullscreenQR(false)}
              className="absolute top-6 right-6 p-2 text-gray-400 hover:text-red-500 transition-all"
            >
              <X size={20} />
            </button>

            <div className="space-y-8 flex flex-col items-center w-full">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-primary mx-auto mb-4 overflow-hidden">
                  {user.profilePicture ? (
                    <img src={squaredProfilePic || user.profilePicture} className="w-full h-full object-cover" />
                  ) : (
                    <User size={32} />
                  )}
                </div>
                <h3 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none">
                  <Username user={user} />
                </h3>
                {((user.firstName || user.lastName) || user.totalXP !== -1) && (
                  <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-1">
                    {(`${user.firstName || ''} ${user.lastName || ''}`.trim()) || getUserFullName(user)}
                  </p>
                )}
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">LitterLooker</p>
              </div>

              <div className="bg-green-50 p-6 rounded-[2.5rem] shadow-inner shadow-black/10 border-4 border-gray-50 dark:border-gray-800">
                <QRCodeSVG 
                  value={`${window.location.origin}?buddy=${user.id}`}
                  size={240}
                  level="H"
                  bgColor="#F0FDF4"
                  fgColor="#166534"
                  includeMargin={false}
                  imageSettings={(squaredProfilePic || user.profilePicture) ? {
                    src: squaredProfilePic || user.profilePicture || '',
                    x: undefined,
                    y: undefined,
                    height: 52,
                    width: 52,
                    excavate: true,
                  } : undefined}
                />
              </div>
              <div className="flex items-center justify-center opacity-100 mt-4">
                <img src={isDarkMode ? "/Graphics/LitterLookerTitleDark.png?v=2" : "/Graphics/LitterLookerTitle.png?v=2"} alt="LitterLooker" className="h-12 object-contain drop-shadow-md" />
              </div>
            </div>
          </div>
        </div>
      )}
      {cropSrc && (
        <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#023020] rounded-[2.5rem] p-6 w-full max-w-sm border-2 border-primary/20 dark:border-gray-800 shadow-2xl animate-pop-in flex flex-col items-center gap-5">
            <div className="text-center w-full">
              <h3 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Crop Profile Photo</h3>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">Drag and Zoom to fit your avatar</p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-3 w-full flex items-center gap-2.5 text-left shadow-sm">
              <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-[9.5px] font-bold text-amber-800 dark:text-amber-200 leading-tight">
                <span className="font-black uppercase tracking-wider block text-amber-700 dark:text-amber-300">Real Photo Required</span>
                Profile picture must be a clear, authentic photo of yourself. Fake or stock images are prohibited.
              </p>
            </div>

            {/* Viewport for cropping */}
            <div 
              className="relative w-72 h-72 rounded-3xl overflow-hidden bg-gray-100 dark:bg-gray-950 border-2 border-gray-200 dark:border-gray-800 touch-none select-none"
              onMouseDown={handleDragStart}
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
            >
              {/* Circular Overlay Masking */}
              <div className="absolute inset-0 border-[24px] border-black/40 pointer-events-none z-10 flex items-center justify-center">
                <div className="w-full h-full rounded-full border-2 border-dashed border-white" />
              </div>

              {/* Placed Image */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <img 
                  src={cropSrc} 
                  alt="Crop preview" 
                  className="max-w-none max-h-none pointer-events-none select-none"
                  style={{
                    transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                  }}
                />
              </div>
            </div>

            {/* Slider controls for Zooming */}
            <div className="w-full space-y-2 px-2">
              <div className="flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <span>Zoom</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.05" 
                value={zoom} 
                onChange={(e) => {
                  audioService.playClick();
                  setZoom(parseFloat(e.target.value));
                }} 
                className="w-full accent-primary bg-gray-100 dark:bg-gray-800 h-2 rounded-lg cursor-pointer"
              />
            </div>

            {/* Action buttons */}
            <div className="w-full flex gap-3">
              <button 
                onClick={() => {
                  setCropSrc(null);
                  audioService.playPop();
                }}
                className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:scale-102 active:scale-98 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  handleCropSave();
                  audioService.playSuccess();
                }}
                className="flex-1 py-3.5 bg-primary text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-primary/25 hover:scale-102 active:scale-98 transition-all"
              >
                Crop & Save
              </button>
            </div>
          </div>
        </div>
      )}
      <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 5;
        }
      `}</style>
    </div>
  );
};