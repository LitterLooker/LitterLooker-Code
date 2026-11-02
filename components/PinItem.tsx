import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Clock, Trash2, CheckCircle, ChevronUp, ChevronDown, Lock, Paperclip, X, Loader2, Sparkles, Flame, Leaf, Crown, Globe, Recycle, User, ShieldCheck, Trees, MapPin as PinIcon, Camera, Send, AlertCircle, ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react';
import { MapPin, UserProfile, ProgressReport, UrgencyLevel, ContentReport } from '../types';
import { VerifiedBadge } from './VerifiedBadge';
import { UserTagPicker } from './UserTagPicker';
import { ConfirmModal } from './ConfirmModal';
import { ReportModal } from './ReportModal';
import { TitleDisplay } from './TitleDisplay';
import { getRankInfo, getUrgencyHexColor, formatFullTimestamp, calculateDistance, calculatePinCredibilityScore, calculateCredibilityScore, compressImage } from '../utils';
import { analyzeCleanupStatus, analyzeUpdatedUrgency, checkPhotoReused, checkSubmissionIntegrity } from '../services/gemini';
import { Username } from './Username';
import { db, auth, OperationType, handleFirestoreError } from '../services/firebase';
import { doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { EDUCATIONAL_TRIVIA_TIPS } from '../constants';

export const PinIconComponent: React.FC<{ design?: string; color: string; size?: number }> = ({ design, color, size = 18 }) => {
  const props = { size, color, style: { filter: `drop-shadow(0 0 4px ${color}66)` } };
  if (design === 'pin_flower') return <Sparkles {...props} className="animate-pulse" />;
  if (design === 'pin_flame') return <Flame {...props} className="animate-bounce" />;
  if (design === 'pin_leaf') return <Leaf {...props} />;
  if (design === 'pin_broom') return <Recycle {...props} />;
  if (design === 'pin_crown') return <Crown {...props} />;
  if (design === 'pin_fire_shield') return <ShieldCheck {...props} />;
  if (design === 'pin_globe') return <Globe {...props} />;
  if (design === 'pin_tree') return <Trees {...props} />;
  return <PinIcon {...props} />;
};

export const PinItem: React.FC<{ 
  pin: MapPin; 
  user: UserProfile; 
  allUsers: Record<string, UserProfile>; 
  isLockedDown: boolean; 
  onDelete: (e: React.MouseEvent | undefined, id: string, wasCleared?: boolean, contributors?: string[]) => void; 
  onViewProfile: (id: string) => void; 
  onAddProgress: (pinId: string, report: ProgressReport) => Promise<void>; 
  onShowNotification: (msg: string, type: 'success' | 'error' | 'warning') => void; 
  isImageDuplicate: (url: string) => boolean; 
  onUpdatePinUrgency: (id: string, newUrgency: UrgencyLevel) => void; 
  onUpdatePinIntensity: (id: string, intensity: number) => Promise<void>;
  isFocused?: boolean;
  onFocus?: () => void;
  userLocation?: { lat: number; lng: number } | null;
  isMapsLoaded: boolean;
  isPendingOffline?: boolean;
  onRetrySync?: () => void;
}> = ({ pin, user, allUsers, isLockedDown, onDelete, onViewProfile, onAddProgress, onShowNotification, isImageDuplicate, onUpdatePinUrgency, onUpdatePinIntensity, isFocused, onFocus, userLocation, isMapsLoaded, isPendingOffline, onRetrySync }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportText, setReportText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const activeTip = useMemo(() => {
    if (!isSubmitting) return "";
    return EDUCATIONAL_TRIVIA_TIPS[Math.floor(Math.random() * EDUCATIONAL_TRIVIA_TIPS.length)];
  }, [isSubmitting]);

  const [aiFailedAttempts, setAiFailedAttempts] = useState(0);
  const [showManualIntensitySelection, setShowManualIntensitySelection] = useState(false);
  const [manualIntensity, setManualIntensity] = useState<number>(50);
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  const [showAllMedia, setShowAllMedia] = useState<string[] | null>(null);
  const [taggedUsernames, setTaggedUsernames] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  
  const currentRank = getRankInfo(user.totalXP);
  const urgencyColor = getUrgencyHexColor(pin.urgency);
  const reports = pin.progressReports || [];
  
  const uidMap = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    Object.values(allUsers).forEach((u: any) => {
      if (u.uid) map[u.uid] = u;
    });
    return map;
  }, [allUsers]);
  
  const getProfile = (username: string, uid?: string) => {
    if (!uid) return allUsers[username];
    return uidMap[uid] || allUsers[username];
  };

  const authorUser = getProfile(pin.username, pin.userId);
  const isOwner = pin.userId === user.id || pin.userId === user.uid || pin.username === user.username;

  useEffect(() => {
    if (isFocused && itemRef.current) {
      setIsExpanded(true);
      const scrollParent = itemRef.current.closest('main') || itemRef.current.closest('.overflow-y-auto');
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        const itemRect = itemRef.current.getBoundingClientRect();
        const targetScrollTop = itemRect.top - parentRect.top + scrollParent.scrollTop - (parentRect.height / 2) + (itemRect.height / 2);
        scrollParent.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
      } else {
        itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [isFocused]);

  const handleIssueWarning = async (reason: string) => {
    console.log(`warning issued to ${user.username}`);
    onShowNotification(reason, "error");
    try {
      await updateDoc(doc(db, "users", user.id), {
        warningCount: increment(1),
        lastWarningAt: Date.now(),
        totalWarningsReceived: increment(1)
      });
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.id}`);
    }
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    (files as File[]).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setMediaFiles(prev => [...prev, compressed]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleVote = async (type: 'upvote' | 'downvote') => {
    if (!user) return;
    if (user.totalXP < 25000) {
      onShowNotification("You must reach Level 2 to vote on pins!", "error");
      return;
    }
    const isUpvoted = pin.upvotes?.includes(user.id);
    const isDownvoted = pin.downvotes?.includes(user.id);

    try {
      const pinRef = doc(db, "pins", pin.id);
      const userRef = doc(db, "users", pin.username);
      
      let newUpvotes = [...(pin.upvotes || [])];
      let newDownvotes = [...(pin.downvotes || [])];
      let upvoteDiff = 0;
      let downvoteDiff = 0;

      if (type === 'upvote') {
        if (isUpvoted) {
          newUpvotes = newUpvotes.filter(id => id !== user.id);
          upvoteDiff = -1;
        } else {
          newUpvotes.push(user.id);
          upvoteDiff = 1;
          if (isDownvoted) {
            newDownvotes = newDownvotes.filter(id => id !== user.id);
            downvoteDiff = -1;
          }
        }
      } else {
        if (isDownvoted) {
          newDownvotes = newDownvotes.filter(id => id !== user.id);
          downvoteDiff = -1;
        } else {
          newDownvotes.push(user.id);
          downvoteDiff = 1;
          if (isUpvoted) {
            newUpvotes = newUpvotes.filter(id => id !== user.id);
            upvoteDiff = -1;
          }
        }
      }

      try {
        await updateDoc(pinRef, { upvotes: newUpvotes, downvotes: newDownvotes });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `pins/${pin.id}`);
      }
      
      const userUpdates: any = {};
      if (upvoteDiff !== 0) userUpdates.totalUpvotesReceived = increment(upvoteDiff);
      if (downvoteDiff !== 0) userUpdates.totalDownvotesReceived = increment(downvoteDiff);
      
      if (Object.keys(userUpdates).length > 0) {
        await updateDoc(userRef, userUpdates);
      }
    } catch (e) {
      console.error("Error voting:", e);
      onShowNotification("Failed to vote.", "error");
    }
  };

  const handlePostReport = async () => {
    if (isSubmitting) return;

    // 1. Cooldown Enforcement (3 Minutes)
    const now = Date.now();
    const COOLDOWN_MS = 3 * 60 * 1000;
    if (user.lastReportAt && (now - user.lastReportAt < COOLDOWN_MS)) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - user.lastReportAt)) / 1000);
      onShowNotification(`Take a breather! Action cooldown: ${remaining}s remaining.`, "warning");
      return;
    }

    // 2. Proximity Enforcement (10 Miles)
    if (userLocation) {
      const distance = calculateDistance(userLocation.lat, userLocation.lng, pin.lat, pin.lng);
      if (distance > 16093.4) { // 10 miles in meters
        onShowNotification(`Too far away! You must be within 10 miles of the site to report progress.`, "error");
        return;
      }
    } else if (!userLocation) {
      onShowNotification("GPS Signal required to verify proximity.", "error");
      return;
    }

    if (mediaFiles.length === 0) {
      onShowNotification("At least one photo is mandatory to report progress!", "warning");
      return;
    }

    if (isLockedDown) { 
      onShowNotification("Reports disabled.", "warning"); 
      return; 
    }
    
    setIsSubmitting(true);
    try {
      // 3. AI Photo Reuse Check against ORIGINAL photo
      if (pin.imageUrl) {
        const isReusedOrig = await checkPhotoReused(pin.imageUrl, mediaFiles[0]);
        if (isReusedOrig) {
          await handleIssueWarning("DUPLICATE PHOTO DETECTED: You are reusing the original pin's photo. A warning has been issued.");
          setIsSubmitting(false);
          return;
        }
      }

      // 4. AI Photo Reuse Check against LATEST update
      if (reports.length > 0) {
        const latestReport = reports[reports.length - 1];
        if (latestReport.mediaUrl) {
          const isReusedLatest = await checkPhotoReused(latestReport.mediaUrl, mediaFiles[0]);
          if (isReusedLatest) {
            await handleIssueWarning("DUPLICATE PHOTO DETECTED: This photo matches your last update. A warning has been issued.");
            setIsSubmitting(false);
            return;
          }
        }
      }

      // AI Submission Integrity Check
      const integrityResult = await checkSubmissionIntegrity(mediaFiles[0], reportText, "Progress Report");
      if (integrityResult.error) {
        // Fallback or continue if AI error
      } else if (!integrityResult.isLegit) {
        onShowNotification(`Anti-Cheat Alert: ${integrityResult.reason || "Suspicious report detected."}`, "error");
        setIsSubmitting(false);
        return;
      }

      const aiResult = await analyzeCleanupStatus(mediaFiles, reportText);
      
      if (aiResult === 'ERROR') {
        const newFailedAttempts = aiFailedAttempts + 1;
        setAiFailedAttempts(newFailedAttempts);
        
        const score = calculateCredibilityScore(user, Object.keys(allUsers).length, allUsers);
        const isHighCredibility = typeof score === 'number' && score >= 80;
        
        if (isHighCredibility && newFailedAttempts >= 2) {
          setShowManualIntensitySelection(true);
          setIsSubmitting(false);
          return;
        } else {
          onShowNotification("AI Services currently unavailable. Please try again later.", "error");
          setIsSubmitting(false);
          return;
        }
      }

      setAiFailedAttempts(0); // Reset on success

      if (aiResult.isInvalid) {
        await handleIssueWarning("IRRELEVANT PHOTO: The mending site is not clearly visible in your proof. A warning has been issued.");
        setIsSubmitting(false);
        return;
      }
      
      await completeReportSubmission(aiResult.percentage, aiResult.isCleaned);
    } catch (err) {
      console.error("Failed to post report:", err);
      const newFailedAttempts = aiFailedAttempts + 1;
      setAiFailedAttempts(newFailedAttempts);
      
      const score = calculateCredibilityScore(user, Object.keys(allUsers).length, allUsers);
      const isHighCredibility = typeof score === 'number' && score >= 80;
      
      if (isHighCredibility && newFailedAttempts >= 2) {
        setShowManualIntensitySelection(true);
      } else {
        onShowNotification("AI Services currently unavailable.", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeReportSubmission = async (percentage: number, isCleaned: boolean) => {
    setIsSubmitting(true);
    try {
      let reward = 0;
      if (isCleaned) {
        reward = 800;
      } else if (percentage < 35) {
        reward = 200;
      } else if (percentage < 70) {
        reward = 400;
      } else {
        reward = 600;
      }

      const report: ProgressReport = {
        id: Math.random().toString(36).substr(2, 9),
        userId: user.uid || user.id,
        username: user.username,
        userProfilePicture: user.profilePicture || '',
        description: reportText.trim(),
        mediaUrl: mediaFiles[0],
        mediaUrls: mediaFiles,
        mediaType: 'image',
        timestamp: Date.now(),
        percentage: percentage
      };

      if (taggedUsernames.length > 0) {
        report.taggedUsernames = taggedUsernames;
      }

      await onAddProgress(pin.id, report);
      
      // Update cooldown in DB
      const updates: any = { 
        lastReportAt: Date.now()
      };
      
      try {
        await updateDoc(doc(db, "users", user.id), updates);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
      }

      setReportText('');
      setMediaFiles([]);
      setTaggedUsernames([]);
      setIsReporting(false);
      setShowManualIntensitySelection(false);
      
      if (isCleaned) {
        onShowNotification(`Area is clean! +${reward} Scrap.`, "success");
        onDelete(undefined, pin.id, true, [user.username, ...taggedUsernames]);
      } else {
        onShowNotification(`Progress reported (${percentage}% cleaner)! +${reward} Scrap.`, "success");
        
        // Update pin intensity
        const currentIntensity = pin.intensity ?? (pin.urgency === 'extreme' ? 90 : pin.urgency === 'moderate' ? 50 : 20);
        const newIntensity = Math.max(0, currentIntensity - percentage);
        
        if (newIntensity < 10) {
          onShowNotification("Litter intensity is now below 10%. Pin removed!", "success");
          onDelete(undefined, pin.id, true, [user.username, ...taggedUsernames]);
        } else {
          await onUpdatePinIntensity(pin.id, newIntensity);
          // Also update urgency for backward compatibility/marker color
          if (newIntensity >= 80) onUpdatePinUrgency(pin.id, 'extreme');
          else if (newIntensity >= 40) onUpdatePinUrgency(pin.id, 'moderate');
          else onUpdatePinUrgency(pin.id, 'light');
        }
      }
    } catch (err) {
      console.error("Error completing report submission:", err);
      onShowNotification("Failed to complete report submission.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportPin = async (reason: string) => {
    try {
      const reportId = `${user.username}_${Date.now()}`;
      const report: ContentReport = {
        id: reportId,
        reporterId: auth.currentUser?.uid || user.id,
        reporterUsername: user.username,
        targetId: pin.id,
        targetType: 'pin',
        reason,
        timestamp: Date.now(),
        status: 'pending'
      };
      await setDoc(doc(db, "moderation", reportId), report);
      await updateDoc(doc(db, "pins", pin.id), {
        reportCount: increment(1)
      });
      onShowNotification("Report submitted successfully.", "success");
    } catch (e) {
      console.error("Error reporting pin:", e);
      onShowNotification("Failed to submit report.", "error");
    }
  };

  return (
    <div 
      ref={itemRef}
      id={`activity-${pin.id}`}
      className={`bg-white dark:bg-[#111827] rounded-3xl shadow-md border-2 overflow-hidden transition-all duration-300 mb-4 
        ${isFocused ? 'animate-border-pulse-green border-primary shadow-xl ring-4 ring-primary/5 scale-[1.02]' : (isExpanded ? 'border-primary shadow-xl ring-4 ring-primary/5' : 'border-gray-100 dark:border-gray-800')} 
        ${isPendingOffline ? 'border-dashed opacity-70 border-gray-400' : ''}`}
    >
      {showAllMedia && (
        <div className="fixed inset-0 z-[5000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowAllMedia(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowAllMedia(null)} className="absolute top-6 right-6 p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><X size={20}/></button>
            <h3 className="text-xl font-black mb-6 uppercase tracking-widest">Media Gallery</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {showAllMedia.map((url, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border dark:border-gray-800 bg-black/5">
                  <img src={url} className="w-full h-auto object-cover" alt={`Gallery ${i}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <ConfirmModal 
          title="Delete Pin?" 
          message="Has the litter been cleared? Deleting without clearing may result in warnings."
          confirmText="Yes, It's Clean!"
          onConfirm={() => { onDelete(undefined, pin.id, true); setShowDeleteConfirm(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      <div className="p-4 cursor-pointer" onClick={() => { setIsExpanded(!isExpanded); if(onFocus) onFocus(); }}>
        <div className="flex items-start gap-4">
          <div className="shrink-0 pt-1">
             <PinIconComponent design={pin.design} color={urgencyColor} size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1 gap-2">
               <h4 className={`font-black text-gray-800 dark:text-gray-100 transition-all duration-300 ${isExpanded ? 'text-lg leading-snug whitespace-pre-wrap' : 'text-base truncate'} flex items-center gap-2 flex-wrap`}>
                {pin.description}
                {typeof calculatePinCredibilityScore(pin, allUsers) === 'number' && (calculatePinCredibilityScore(pin, allUsers) as number) > 80 && (
                  <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0">
                    <ShieldCheck size={12} /> Verified
                  </span>
                )}
               </h4>
               <div className="flex flex-col items-end gap-1 shrink-0">
                 <div className="w-24 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border dark:border-gray-700">
                   <div 
                     className="h-full transition-all duration-1000" 
                     style={{ 
                       width: `${pin.intensity ?? (pin.urgency === 'extreme' ? 90 : pin.urgency === 'moderate' ? 50 : 20)}%`,
                       backgroundColor: urgencyColor 
                     }} 
                   />
                 </div>
                 <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">
                   Intensity: {Math.round(pin.intensity ?? (pin.urgency === 'extreme' ? 90 : pin.urgency === 'moderate' ? 50 : 20))}%
                 </span>
               </div>
            </div>
            <div className="flex items-center justify-between">
              <div onClick={(e) => { e.stopPropagation(); onViewProfile(pin.username); }} className="flex items-center gap-2 group">
                 <div className={`w-8 h-8 rounded-full overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 shrink-0`}>
                   {authorUser?.profilePicture ? <img src={authorUser.profilePicture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><User size={12}/></div>}
                 </div>
                 <div className="flex flex-col">
                   <span className="text-[10px] flex items-center gap-0.5">
                     <span className="text-gray-400 font-bold">@</span>
                     <Username user={authorUser || { username: pin.username, id: pin.userId, totalXP: 0, availableXP: 0, joinedAt: 0 }} className="group-hover:text-primary transition-colors" />
                     {authorUser?.permissions?.isVerified && <VerifiedBadge size={10} />}
                   </span>
                   {authorUser?.selectedTitle && (
                     <div className="leading-none mt-0.5">
                       <TitleDisplay title={authorUser.selectedTitle} size="xs" />
                     </div>
                   )}
                 </div>
              </div>
              <div className="flex items-center gap-2">
                {isPendingOffline && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRetrySync?.(); }}
                    className="p-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-500 dark:hover:bg-yellow-900 rounded-lg transition-colors flex items-center justify-center shadow-sm z-10"
                    title="Retry Save"
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
                <span className="text-[10px] text-gray-400 font-medium uppercase">{formatFullTimestamp(pin.timestamp)}</span>
              </div>
            </div>
          </div>
          <div className="shrink-0 text-gray-300">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-6 space-y-4 animate-fade-in border-t dark:border-gray-800 mt-2">
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={(e) => { e.stopPropagation(); handleVote('upvote'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${pin.upvotes?.includes(user?.id || '') ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              >
                <ChevronUp size={16} /> {pin.upvotes?.length || 0}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleVote('downvote'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${pin.downvotes?.includes(user?.id || '') ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              >
                <ChevronDown size={16} /> {pin.downvotes?.length || 0}
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-xl">
              <ShieldCheck size={14} className={typeof calculatePinCredibilityScore(pin, allUsers) === 'number' && (calculatePinCredibilityScore(pin, allUsers) as number) > 80 ? 'text-blue-500' : ''} />
              <span className={calculatePinCredibilityScore(pin, allUsers) === 'No score yet' ? 'text-[10px]' : ''}>
                {calculatePinCredibilityScore(pin, allUsers)}
              </span>
            </div>
          </div>

          {pin.imageUrl && (
            <div className="rounded-2xl overflow-hidden border dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 mt-4 relative group">
              <img src={pin.imageUrl} className="w-full h-auto object-cover max-h-72" alt="Initial report" />
              {pin.mediaUrls && pin.mediaUrls.length > 1 && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowAllMedia(pin.mediaUrls || []); }}
                  className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-primary transition-all shadow-lg"
                >
                  <ExternalLink size={12} /> View All {pin.mediaUrls.length} Photos
                </button>
              )}
            </div>
          )}

          {isOwner && (
            <div className="bg-gray-50 dark:bg-gray-900/40 p-3 rounded-2xl border dark:border-gray-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="text-primary" />
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Litter Intensity</span>
                </div>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                  {Math.round(pin.intensity ?? (pin.urgency === 'extreme' ? 90 : pin.urgency === 'moderate' ? 50 : 20))}%
                </span>
              </div>
              
              <div className="w-full h-4 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden border dark:border-gray-700">
                <div 
                  className="h-full transition-all duration-1000" 
                  style={{ 
                    width: `${pin.intensity ?? (pin.urgency === 'extreme' ? 90 : pin.urgency === 'moderate' ? 50 : 20)}%`,
                    backgroundColor: urgencyColor 
                  }} 
                />
              </div>

              {/* Manual override only if AI fails (simulated here by checking if verified and user wants to override) */}
              {/* The user said: "Do not allow the user that posted the pin to update the severity manually unless AI services are unavailable." */}
              {/* We can interpret "AI services unavailable" as a state or just hide it normally. */}
              {/* For now, I'll hide the buttons and only show them if a specific "AI Failed" flag was set, but the user didn't specify how to detect it here. */}
              {/* Actually, I'll just remove the buttons as requested and maybe add a small note. */}
              <p className="text-[8px] text-gray-400 font-bold uppercase text-center">Intensity is managed by AI analysis of progress updates.</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
             <div className="flex items-center gap-3">
               <button 
                 onClick={() => {
                   setIsReporting(!isReporting);
                 }} 
                 className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-primary/90 transition-all shadow-md active:scale-95"
               >
                 <Camera size={14} /> Report Progress
               </button>
               {reports.length > 0 && (
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{reports.length} Updates</span>
               )}
             </div>
             {isOwner && (
               <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                 <Trash2 size={18} />
               </button>
             )}
             {!isOwner && (
               <button onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }} className="p-2 text-gray-300 hover:text-red-500 transition-colors" title="Report Pin">
                 <AlertTriangle size={18} />
               </button>
             )}
          </div>

          {isReporting && (
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-[2rem] border-2 border-primary/20 space-y-3 animate-slide-up relative">
              {isSubmitting && (
                <div className="absolute inset-0 bg-white/95 dark:bg-gray-950/95 z-[30] flex flex-col items-center justify-center rounded-[2rem] p-6 text-center space-y-4">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <Recycle size={28} className="text-primary animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-black text-primary uppercase tracking-[0.15em] block">AI Integrity Check...</span>
                    <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">Scanning duplicates & verifying progress</p>
                  </div>
                  <div className="w-full max-w-xs p-3.5 bg-primary/5 dark:bg-primary/20 border border-primary/10 rounded-2xl space-y-1 shadow-inner">
                    <p className="text-[8px] font-black text-primary uppercase tracking-[0.2em] opacity-80 flex items-center justify-center gap-1">
                      <Leaf size={10} /> Did You Know?
                    </p>
                    <p className="text-[10px] font-bold text-gray-600 dark:text-gray-300 leading-normal">
                      {activeTip}
                    </p>
                  </div>
                </div>
              )}
              {showManualIntensitySelection && (
                <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 z-[40] flex flex-col items-center justify-center rounded-[2rem] p-6 text-center space-y-4">
                  <div className="bg-primary/10 p-3 rounded-full text-primary">
                    <AlertCircle size={32} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tight">Manual Progress Update</h4>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                      AI detection failed. Since you have high credibility, you can manually set the cleanup percentage.
                    </p>
                  </div>
                  
                  <div className="w-full space-y-2">
                    <div className="flex justify-between text-[10px] font-black text-primary uppercase tracking-widest">
                      <span>Progress</span>
                      <span>{manualIntensity}%</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      value={manualIntensity}
                      onChange={(e) => setManualIntensity(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>

                  <div className="flex gap-2 w-full">
                    <button 
                      onClick={() => setShowManualIntensitySelection(false)}
                      className="flex-1 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => completeReportSubmission(manualIntensity, manualIntensity === 100)}
                      className="flex-1 py-3 bg-primary text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
              <textarea 
                className="w-full p-4 rounded-2xl border dark:border-gray-800 bg-white dark:bg-gray-800 text-xs outline-none focus:ring-2 focus:ring-primary/30 resize-none text-gray-900 dark:text-white font-medium" 
                placeholder="What did you do? (e.g., cleared 50%, bag is full...)" 
                rows={3}
                value={reportText}
                onChange={e => setReportText(e.target.value)}
              />
              <div className="flex gap-2">
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className={`flex-1 py-3 rounded-2xl border-2 border-dashed text-[10px] font-black uppercase transition-all shadow-sm ${mediaFiles.length > 0 ? 'bg-primary/10 border-primary text-primary' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Camera size={16} />
                    {mediaFiles.length > 0 ? `${mediaFiles.length} Photos` : 'Attach Photos (Required)'}
                  </div>
                </button>
                <UserTagPicker 
                  allUsers={allUsers} 
                  currentUser={user} 
                  selectedUsernames={taggedUsernames} 
                  onToggleUser={u => setTaggedUsernames(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u])} 
                  variant="icon"
                  buddyIds={user.friends}
                />
              </div>
              {mediaFiles.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {mediaFiles.map((img, idx) => (
                    <div key={idx} className="relative shrink-0">
                      <img src={img} className="w-12 h-12 rounded-lg object-cover border dark:border-gray-700" />
                      <button onClick={() => setMediaFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm"><X size={8}/></button>
                    </div>
                  ))}
                </div>
              )}
              <input type="file" ref={fileInputRef} multiple onChange={handleMediaSelect} className="hidden" accept="image/*" />
              <button 
                onClick={handlePostReport} 
                disabled={isSubmitting || mediaFiles.length === 0} 
                className="w-full py-4 bg-primary text-white font-black rounded-2xl text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all"
              >
                Submit Update
              </button>
            </div>
          )}

          {reports.length > 0 && (
            <div className="space-y-4 pt-4 border-t dark:border-gray-800">
              <h5 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                <Clock size={12} /> Progress History
              </h5>
              <div className="space-y-4">
                {reports.slice().reverse().map(report => {
                  const reportUser = getProfile(report.username, report.userId);
                  return (
                    <div key={report.id} className={`bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border dark:border-gray-800 animate-slide-up ${(report as any).isPendingOffline ? 'border-dashed opacity-70 border-gray-400' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                           <div onClick={() => onViewProfile(report.username)} className="w-8 h-8 rounded-full overflow-hidden bg-white border border-gray-100 dark:border-gray-800 cursor-pointer hover:ring-2 ring-primary transition-all">
                             {(reportUser?.profilePicture || report.userProfilePicture) ? <img src={reportUser?.profilePicture || report.userProfilePicture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px] font-black">{report.username.slice(0,2).toUpperCase()}</div>}
                           </div>
                           <div className="flex flex-col">
                             <span onClick={() => onViewProfile(report.username)} className="text-[11px] font-black flex items-center gap-1 cursor-pointer group">
                               <span className="text-gray-400">@</span>
                               <Username user={reportUser || { username: report.username, id: report.userId, totalXP: 0, availableXP: 0, joinedAt: 0 }} />
                               {reportUser?.permissions?.isVerified && <VerifiedBadge size={10} />}
                             </span>
                             {reportUser?.selectedTitle && (
                               <div className="leading-none mt-0.5">
                                 <TitleDisplay title={reportUser.selectedTitle} size="xs" />
                               </div>
                             )}
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           {(report as any).isPendingOffline && (
                             <button 
                               onClick={(e) => { e.stopPropagation(); onRetrySync?.(); }}
                               className="p-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-500 dark:hover:bg-yellow-900 rounded-md transition-colors flex items-center justify-center shadow-sm"
                               title="Retry Save"
                             >
                               <RefreshCw size={12} />
                             </button>
                           )}
                           <span className="text-[9px] text-gray-400 font-black uppercase tracking-tighter">{formatFullTimestamp(report.timestamp)}</span>
                        </div>
                      </div>
                      {report.description && <p className="text-xs text-gray-700 dark:text-gray-300 mb-3 leading-relaxed whitespace-pre-wrap font-medium">{report.description}</p>}
                      {report.mediaUrl && (
                        <div className="rounded-xl overflow-hidden border dark:border-gray-800 bg-black/5 relative group">
                          <img src={report.mediaUrl} className="w-full max-h-48 object-cover" alt="Progress proof" />
                          {report.mediaUrls && report.mediaUrls.length > 1 && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setShowAllMedia(report.mediaUrls || []); }}
                              className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1 hover:bg-primary transition-all shadow-lg"
                            >
                              <ExternalLink size={10} /> View All {report.mediaUrls.length}
                            </button>
                          )}
                        </div>
                      )}
                      {report.percentage !== undefined && (
                        <div className="mt-3 flex items-center justify-center bg-primary/5 p-2 rounded-xl border border-primary/10">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                            ✨ {report.percentage}% Cleaner!
                          </span>
                        </div>
                      )}
                      {report.taggedUsernames && report.taggedUsernames.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t dark:border-gray-800/50">
                           {report.taggedUsernames.map(u => {
                             const taggedUser = (Object.values(allUsers) as UserProfile[]).find(x => x.username === u) || allUsers[u];
                             return (
                               <div key={u} onClick={() => onViewProfile(u)} className="text-[9px] bg-primary/10 text-primary px-2 py-1 rounded-lg font-black flex items-center gap-1 cursor-pointer hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95">
                                 <span>@</span>
                                 <Username user={taggedUser || { username: u, id: '', totalXP: 0, availableXP: 0, joinedAt: 0 }} />
                                 {taggedUser?.permissions?.isVerified && <VerifiedBadge size={10} />}
                               </div>
                             );
                           })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <ReportModal 
        isOpen={showReportModal} 
        onClose={() => setShowReportModal(false)} 
        onSubmit={handleReportPin} 
        title="Pin" 
      />
    </div>
  );
};
