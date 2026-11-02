import React, { useState, useMemo, useEffect } from 'react';
import { X, User, UserPlus, UserCheck, Clock, Users, Medal, Zap, Trophy, AlertCircle, Loader2, Ban, ArrowUp, ArrowDown } from 'lucide-react';
import { UserProfile } from '../types';
import { RankBadge } from './RankBadge';
import { TitleDisplay } from './TitleDisplay';
import { TagBadge } from './TagBadge';
import { VerifiedBadge } from './VerifiedBadge';
import { ICONS, INFINITY_XP, INFINITY_SYMBOL } from '../constants';
import { AchievementsPage } from './AchievementsPage';
import { Username } from './Username';
import { calculateCredibilityScore, getRankInfo, getUserFullName } from '../utils';
import { db } from '../services/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, increment, runTransaction, writeBatch } from 'firebase/firestore';
import { ConfirmModal } from './ConfirmModal';

export const ViewProfileModal: React.FC<{ 
  userId: string; 
  currentUser: UserProfile;
  allUsers: Record<string, UserProfile>;
  onClose: () => void; 
  onShowRankPath: (u: UserProfile) => void;
  onSendRequest: (targetId: string) => void;
  onBlockUser?: (targetId: string) => void;
  onReportUser?: (targetId: string, targetUsername: string, reason: string) => void;
  onShowNotification: (message: string, type?: 'success' | 'error' | 'warning') => void;
}> = ({ userId, currentUser, allUsers, onClose, onShowRankPath, onSendRequest, onBlockUser, onReportUser, onShowNotification }) => {
  const [showAchievements, setShowAchievements] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningReason, setWarningReason] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [fetchedProfile, setFetchedProfile] = useState<UserProfile | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);
  
  // STABLE LOOKUP
  const profile = useMemo(() => {
    if (fetchedProfile) return fetchedProfile;
    if (!userId) return null;
    const userArray = Object.values(allUsers) as UserProfile[];
    
    // 1. Try exact match by UID
    const byUidField = userArray.find(u => u.uid === userId);
    if (byUidField) return byUidField;
    
    // 2. Try exact match by key (username)
    if (allUsers[userId]) return allUsers[userId];
    
    // 3. Try exact match by username field
    const byUsernameField = userArray.find(u => u.username === userId);
    if (byUsernameField) return byUsernameField;

    // 4. Try case-insensitive match by username
    const byUsernameCase = userArray.find(u => u.username.toLowerCase() === userId.toLowerCase());
    return byUsernameCase || null;
  }, [userId, allUsers, fetchedProfile]);

  useEffect(() => {
    if (!profile && userId && !isFetching && !hasAttemptedFetch) {
      const fetchUser = async () => {
        setIsFetching(true);
        try {
          // 1. Try fetching by document ID (usually Username in this app)
          const userDoc = await getDoc(doc(db, "users", userId));
          if (userDoc.exists()) {
            setFetchedProfile({ ...userDoc.data(), id: userDoc.id } as UserProfile);
            setIsFetching(false);
            setHasAttemptedFetch(true);
            return;
          }

          // 2. Try fetching by username field (exact match)
          const qName = query(collection(db, "users"), where("username", "==", userId));
          const snapName = await getDocs(qName);
          if (!snapName.empty) {
            const d = snapName.docs[0];
            setFetchedProfile({ ...d.data(), id: d.id } as UserProfile);
            setIsFetching(false);
            setHasAttemptedFetch(true);
            return;
          }

          // 3. Try fetching by uid field (if userId is a UID)
          const qUid = query(collection(db, "users"), where("uid", "==", userId));
          const snapUid = await getDocs(qUid);
          if (!snapUid.empty) {
            const d = snapUid.docs[0];
            setFetchedProfile({ ...d.data(), id: d.id } as UserProfile);
            setIsFetching(false);
            setHasAttemptedFetch(true);
            return;
          }
        } catch (e) {
          console.error("Error fetching user profile", e);
        } finally {
          setIsFetching(false);
          setHasAttemptedFetch(true);
        }
      };
      fetchUser();
    }
  }, [profile, userId, isFetching, hasAttemptedFetch]);

  const isOnline = useMemo(() => {
    if (!profile) return false;
    if (profile.visibility === 'inactive') return false;
    if (!profile.lastActiveAt) return false;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return (now - profile.lastActiveAt) < fiveMinutes;
  }, [profile]);
  
  if (isFetching) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl w-full max-w-sm relative border dark:border-gray-700 animate-pop-in text-center flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={40} />
          <p className="text-sm font-bold text-gray-500">Searching for mender...</p>
        </div>
      </div>
    );
  }
  
  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl w-full max-w-sm relative border dark:border-gray-700 animate-pop-in text-center">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition p-2"><X size={20} /></button>
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase mb-2">User Not Found</h3>
          <p className="text-sm font-bold text-gray-500 mb-6">This mender no longer has an active account on LitterLooker.</p>
          <button onClick={onClose} className="w-full bg-primary text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-lg shadow-primary/20">Close</button>
        </div>
      </div>
    );
  }

  if (showAchievements) {
    return (
      <div className="fixed top-0 bottom-0 left-1/2 -translate-x-1/2 w-full max-w-7xl z-[110] flex flex-col bg-white dark:bg-gray-900 animate-slide-up">
        <AchievementsPage 
          user={currentUser} 
          allUsers={allUsers} 
          onBack={() => setShowAchievements(false)} 
          targetUser={profile}
        />
      </div>
    );
  }

  const isSelf = currentUser ? (currentUser.id === profile.id || currentUser.uid === profile.uid) : false;
  const isFriend = currentUser ? (currentUser.friends || []).some(fId => fId === profile.id || fId === profile.uid) : false;
  const hasSentRequest = currentUser ? (profile.friendRequests || []).some(r => r.fromUserId === currentUser.id || r.fromUserId === currentUser.uid) : false;
  const hasReceivedRequest = currentUser ? (currentUser.friendRequests || []).some(r => r.fromUserId === profile.id || r.fromUserId === profile.uid) : false;

  const friendsAvatars = (profile.friends || []).map(id => allUsers[id]).filter(Boolean) as UserProfile[];
  const friendsCount = friendsAvatars.length;

  const hasUpvoted = currentUser ? profile.upvotedBy?.includes(currentUser.id) : false;
  const hasDownvoted = currentUser ? profile.downvotedBy?.includes(currentUser.id) : false;

  const handleUpvote = async () => {
    if (!currentUser || isSelf) return;
    if (currentUser.totalXP < 25000) {
      onShowNotification("You must reach Level 2 to vote on profiles!", "error");
      return;
    }
    try {
      const userRef = doc(db, 'users', profile.id);
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw "User does not exist!";
        
        const userData = userDoc.data() as UserProfile;
        const hasUpvotedNow = userData.upvotedBy?.includes(currentUser.id);
        const hasDownvotedNow = userData.downvotedBy?.includes(currentUser.id);
        
        let updates: any = {};
        let newUpvotedBy = [...(userData.upvotedBy || [])];
        let newDownvotedBy = [...(userData.downvotedBy || [])];
        let newTotalUpvotes = userData.totalUpvotesReceived || 0;
        let newTotalDownvotes = userData.totalDownvotesReceived || 0;
        
        if (hasUpvotedNow) {
          newUpvotedBy = newUpvotedBy.filter(id => id !== currentUser.id);
          newTotalUpvotes = Math.max(0, newTotalUpvotes - 1);
          updates.upvotedBy = arrayRemove(currentUser.id);
          updates.totalUpvotesReceived = increment(-1);
        } else {
          newUpvotedBy.push(currentUser.id);
          newTotalUpvotes += 1;
          updates.upvotedBy = arrayUnion(currentUser.id);
          updates.totalUpvotesReceived = increment(1);
          if (hasDownvotedNow) {
            newDownvotedBy = newDownvotedBy.filter(id => id !== currentUser.id);
            newTotalDownvotes = Math.max(0, newTotalDownvotes - 1);
            updates.downvotedBy = arrayRemove(currentUser.id);
            updates.totalDownvotesReceived = increment(-1);
          }
        }
        
        // Calculate new score with the updated arrays
        const updatedUserData = { 
          ...userData, 
          upvotedBy: newUpvotedBy, 
          downvotedBy: newDownvotedBy,
          totalUpvotesReceived: newTotalUpvotes,
          totalDownvotesReceived: newTotalDownvotes
        };
        
        const newScore = calculateCredibilityScore(updatedUserData, Object.keys(allUsers).length, allUsers);
        updates.credibilityScore = typeof newScore === 'number' ? newScore : 0;
        
        transaction.update(userRef, updates);
        
        // Update local state with the actual data, not FieldValues
        const finalLocalData = { 
          ...userData, 
          upvotedBy: newUpvotedBy, 
          downvotedBy: newDownvotedBy, 
          totalUpvotesReceived: newTotalUpvotes, 
          totalDownvotesReceived: newTotalDownvotes,
          credibilityScore: updates.credibilityScore
        };
        setFetchedProfile(finalLocalData);
      });
      onShowNotification("Vote recorded!", "success");
    } catch (error) {
      console.error("Error upvoting user:", error);
      onShowNotification("Failed to vote. Please try again.", "error");
    }
  };

  const handleDownvote = async () => {
    if (!currentUser || isSelf) return;
    if (currentUser.totalXP < 25000) {
      onShowNotification("You must reach Level 2 to vote on profiles!", "error");
      return;
    }
    try {
      const userRef = doc(db, 'users', profile.id);
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw "User does not exist!";
        
        const userData = userDoc.data() as UserProfile;
        const hasUpvotedNow = userData.upvotedBy?.includes(currentUser.id);
        const hasDownvotedNow = userData.downvotedBy?.includes(currentUser.id);
        
        let updates: any = {};
        let newUpvotedBy = [...(userData.upvotedBy || [])];
        let newDownvotedBy = [...(userData.downvotedBy || [])];
        let newTotalUpvotes = userData.totalUpvotesReceived || 0;
        let newTotalDownvotes = userData.totalDownvotesReceived || 0;
        
        if (hasDownvotedNow) {
          newDownvotedBy = newDownvotedBy.filter(id => id !== currentUser.id);
          newTotalDownvotes = Math.max(0, newTotalDownvotes - 1);
          updates.downvotedBy = arrayRemove(currentUser.id);
          updates.totalDownvotesReceived = increment(-1);
        } else {
          newDownvotedBy.push(currentUser.id);
          newTotalDownvotes += 1;
          updates.downvotedBy = arrayUnion(currentUser.id);
          updates.totalDownvotesReceived = increment(1);
          if (hasUpvotedNow) {
            newUpvotedBy = newUpvotedBy.filter(id => id !== currentUser.id);
            newTotalUpvotes = Math.max(0, newTotalUpvotes - 1);
            updates.upvotedBy = arrayRemove(currentUser.id);
            updates.totalUpvotesReceived = increment(-1);
          }
        }
        
        // Calculate new score with the updated arrays
        const updatedUserData = { 
          ...userData, 
          upvotedBy: newUpvotedBy, 
          downvotedBy: newDownvotedBy,
          totalUpvotesReceived: newTotalUpvotes,
          totalDownvotesReceived: newTotalDownvotes
        };
        
        const newScore = calculateCredibilityScore(updatedUserData, Object.keys(allUsers).length, allUsers);
        updates.credibilityScore = typeof newScore === 'number' ? newScore : 0;
        
        transaction.update(userRef, updates);
        
        // Update local state with the actual data, not FieldValues
        const finalLocalData = { 
          ...userData, 
          upvotedBy: newUpvotedBy, 
          downvotedBy: newDownvotedBy, 
          totalUpvotesReceived: newTotalUpvotes, 
          totalDownvotesReceived: newTotalDownvotes,
          credibilityScore: updates.credibilityScore
        };
        setFetchedProfile(finalLocalData);
      });
      onShowNotification("Vote recorded!", "success");
    } catch (error) {
      console.error("Error downvoting user:", error);
      onShowNotification("Failed to vote. Please try again.", "error");
    }
  };

  const displayTags = (profile.tags || []).filter(t => t !== 'Verified');
  if (profile.permissions?.isCreator) displayTags.push('Creator');
  if (profile.permissions?.isTester) displayTags.push('Tester');
  if (profile.permissions?.isModerator) displayTags.push('Moderator');

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl w-full max-sm relative border dark:border-gray-700 max-h-[90vh] overflow-y-auto hide-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition z-10" type="button"><X size={20} /></button>
        <div className="flex flex-col items-center gap-4 mt-2">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white dark:border-gray-700 shadow-lg bg-gray-200">
              {profile.profilePicture ? <img src={profile.profilePicture} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 dark:bg-gray-800"><User size={40} /></div>}
            </div>
            {isOnline && (
              <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-white dark:border-gray-800 rounded-full shadow-sm z-10 animate-pulse" />
            )}
          </div>
          <div className="text-center w-full">
            <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 flex items-center justify-center gap-1">
              <span className="flex items-center gap-0.5">
                <Username user={profile} />
              </span>
              {(profile.permissions?.isVerified || profile.permissions?.isCreator || profile.permissions?.isModerator || profile.permissions?.isAdmin || profile.isAdmin) && <VerifiedBadge size={16} />}
            </h3>
            {((profile.firstName || profile.lastName) || profile.totalXP !== -1) && (
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
                {(`${profile.firstName || ''} ${profile.lastName || ''}`.trim()) || getUserFullName(profile)}
              </p>
            )}
            {displayTags.length > 0 && (<div className="flex flex-wrap justify-center gap-1.5 mt-1.5 mb-2">{displayTags.map(t => <TagBadge key={t} tag={t} />)}</div>)}
            {profile.selectedTitle && (<div className="mt-1"><TitleDisplay title={profile.selectedTitle} size="sm" /></div>)}
            {profile.teamName && (
              <div className="mt-2 flex items-center justify-center gap-1.5 px-3 py-1 bg-primary/5 dark:bg-primary/10 rounded-full border border-primary/10 max-w-[200px] mx-auto">
                <Users size={12} className="text-primary" />
                <span className="text-[10px] font-black text-primary uppercase tracking-widest truncate">{profile.teamName}</span>
              </div>
            )}
            {profile.description && (
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-3 max-w-[250px] mx-auto leading-relaxed">
                {profile.description}
              </p>
            )}
            {(isSelf || profile.publicProfileSettings?.showRank !== false) && (
              <div className="mt-2 flex justify-center"><RankBadge points={profile.totalXP} size="md" onClick={() => onShowRankPath(profile)} /></div>
            )}
          </div>

          <div className="w-full px-2 space-y-2">
            {!isSelf && (
              <>
                {isFriend ? (
                  <div className="w-full py-3 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest border border-green-100 dark:border-green-800">
                    <UserCheck size={16} /> Buddies
                  </div>
                ) : hasSentRequest ? (
                  <div className="w-full py-3 bg-gray-50 dark:bg-gray-700/50 text-gray-400 rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest border border-gray-100 dark:border-gray-700">
                    <Clock size={16} /> Request Sent
                  </div>
                ) : hasReceivedRequest ? (
                  <div className="w-full py-3 bg-primary/10 text-primary rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest border border-primary/20 animate-pulse">
                    <Clock size={16} /> Request Received
                  </div>
                ) : (
                  profile.totalXP !== INFINITY_XP && profile.allowFriendRequests !== false && (
                    <button 
                      onClick={() => onSendRequest(profile.id)}
                      className="w-full py-3 bg-primary text-white rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all"
                    >
                      <UserPlus size={16} /> Add Mending Buddy
                    </button>
                  )
                )}
              </>
            )}

            {(isFriend || isSelf) && (isSelf || profile.publicProfileSettings?.showAchievements !== false) && (
              <button 
                onClick={() => setShowAchievements(true)}
                className="w-full py-3 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest border border-green-200 dark:border-green-800 active:scale-95 transition-all"
              >
                <Medal size={16} /> View Achievements
              </button>
            )}

            {!isSelf && onBlockUser && profile.totalXP !== INFINITY_XP && (
              <div className="flex flex-col gap-2 mt-2">
                <button 
                  onClick={() => setShowBlockConfirm(true)}
                  className="w-full py-3 bg-gray-50 dark:bg-gray-800 text-gray-400 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all border border-transparent hover:border-red-200"
                >
                  <Ban size={14} /> Block User
                </button>
                <button 
                  onClick={() => setShowReportConfirm(true)}
                  className="w-full py-2 text-gray-400 hover:text-red-500 transition-all text-[10px] font-bold uppercase tracking-widest text-center"
                >
                  Report User
                </button>
                {(currentUser.permissions?.isModerator || currentUser.isAdmin) && (
                  <button 
                    onClick={() => setShowWarningModal(true)}
                    className="w-full py-2 text-orange-500 hover:text-orange-600 transition-all text-[10px] font-bold uppercase tracking-widest text-center"
                  >
                    Issue Warning
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="w-full space-y-3">
            {profile.totalXP !== -1 && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-xs font-bold text-gray-400 uppercase">Credibility Score</p>
                    <p className={`font-black text-primary ${calculateCredibilityScore(profile, Object.keys(allUsers).length, allUsers) === 'No score yet' ? 'text-sm' : 'text-2xl'}`}>
                      {profile.totalXP === INFINITY_XP ? '' : calculateCredibilityScore(profile, Object.keys(allUsers).length, allUsers)}
                    </p>
                  </div>
                  <Medal className="text-primary" size={32} />
                </div>
                {!isSelf && profile.totalXP !== INFINITY_XP && getRankInfo(currentUser.totalXP).level > 1 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                    <button
                      onClick={handleUpvote}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold uppercase transition-colors ${hasUpvoted ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                      <ArrowUp size={14} /> Upvote
                    </button>
                    <button
                      onClick={handleDownvote}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold uppercase transition-colors ${hasDownvoted ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                      <ArrowDown size={14} /> Downvote
                    </button>
                  </div>
                )}
              </div>
            )}

            {(isSelf || profile.publicProfileSettings?.showTotalXP !== false) && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="text-left"><p className="text-xs font-bold text-gray-400 uppercase">Total XP</p><p className="text-2xl font-black text-primary">{profile.totalXP === INFINITY_XP ? INFINITY_SYMBOL : profile.totalXP.toLocaleString()}</p></div>
                <Zap className="text-primary animate-pulse" size={32} />
              </div>
            )}

            {(isSelf || profile.publicProfileSettings?.showBuddies !== false) && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-1.5"><Users size={12} /> Buddies ({friendsCount})</h4>
                </div>
                {friendsCount > 0 ? (
                  <div className="flex -space-x-3 overflow-hidden">
                    {friendsAvatars.slice(0, 8).map((f, i) => (
                      <div key={f.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-200 overflow-hidden shrink-0">
                        {f.profilePicture ? <img src={f.profilePicture} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-[10px] text-gray-400"><User size={14}/></div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-400 italic">No buddies yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showBlockConfirm && (
        <ConfirmModal
          title="Block User?"
          message={`Are you sure you want to block @${profile.username}? You won't see their content anymore.`}
          onConfirm={() => {
            if (onBlockUser) {
              onBlockUser(profile.id);
              onClose();
            }
            setShowBlockConfirm(false);
          }}
          onCancel={() => setShowBlockConfirm(false)}
          confirmText="Block"
          isDestructive={true}
        />
      )}

      {showWarningModal && (
        <div className="fixed inset-0 z-[6000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-sm border dark:border-gray-800 shadow-2xl">
            <h3 className="text-lg font-black uppercase tracking-tighter mb-4">Issue Warning</h3>
            <textarea
              placeholder="Reason for warning..."
              value={warningReason}
              onChange={(e) => setWarningReason(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-3 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500/50 transition-all mb-4 h-24 resize-none"
            />
            <div className="flex gap-3">
              <button 
                onClick={() => { setShowWarningModal(false); setWarningReason(''); }}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (!warningReason.trim()) return;
                  try {
                    const batch = writeBatch(db);
                    const targetRef = doc(db, 'users', profile.id);
                    const modRef = doc(db, 'users', currentUser.id);

                    const userUpdates: any = {
                      warningCount: increment(1),
                      lastWarningAt: Date.now(),
                      blockHistory: arrayUnion({
                        type: 'warning',
                        timestamp: Date.now(),
                        reason: warningReason.trim()
                      })
                    };

                    if (profile.id !== currentUser.id) {
                      userUpdates.notifications = arrayUnion({
                        id: Math.random().toString(36).substr(2, 9),
                        message: `You have received a warning: ${warningReason.trim()}`,
                        timestamp: Date.now(),
                        read: false
                      });
                    }

                    batch.update(targetRef, userUpdates);
                    batch.update(modRef, { warningsSentCount: increment(1) });

                    await batch.commit();
                    onShowNotification("Warning issued.", "warning");
                    setShowWarningModal(false);
                    setWarningReason('');
                  } catch (e) {
                    console.error("Error issuing warning:", e);
                    onShowNotification("Failed to issue warning.", "error");
                  }
                }}
                disabled={!warningReason.trim()}
                className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                Issue
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportConfirm && (
        <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-6 animate-fade-in backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl w-full max-w-sm border dark:border-gray-700 animate-pop-in">
            <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase mb-2">Report @{profile.username}</h3>
            <p className="text-xs font-bold text-gray-500 mb-4">Please provide a reason for reporting this user. Our team will review it.</p>
            
            <textarea 
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Reason for report (e.g. inappropriate content, spam, cheating...)"
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all mb-4 min-h-[100px] resize-none"
            />

            <div className="flex gap-3">
              <button 
                onClick={() => setShowReportConfirm(false)}
                className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 font-black rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (onReportUser && reportReason.trim()) {
                    onReportUser(profile.id, profile.username, reportReason.trim());
                    setShowReportConfirm(false);
                    setReportReason('');
                    onClose();
                  }
                }}
                disabled={!reportReason.trim()}
                className="flex-1 py-4 bg-red-500 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
