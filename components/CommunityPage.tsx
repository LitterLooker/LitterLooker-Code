import React, { useState, useRef, useMemo } from 'react';
import { Plus, X, User, Image as ImageIcon, Link as LinkIcon, Send, Loader2, MapPin as PinIcon, MessageCircle, Trash2, Megaphone, Tag, Search, ChevronUp, ChevronDown, Trophy, BarChart3, Weight, Maximize, Hash, AlertTriangle, Users, Zap } from 'lucide-react';
import { UserProfile, CommunityPost, MapPin as MapPinType, Announcement, Reply, GlobalSettings, ContentReport } from '../types';
import { VerifiedBadge } from './VerifiedBadge';
import { TagBadge } from './TagBadge';
import { TitleDisplay } from './TitleDisplay';
import { UserTagPicker } from './UserTagPicker';
import { ConfirmModal } from './ConfirmModal';
import { ReportModal } from './ReportModal';
import { LitterStatsGraph } from './LitterStatsGraph';
import { getRankInfo, getLocalDateString, formatFullTimestamp, compressImage } from '../utils';
import { Username } from './Username';
import { db } from '../services/firebase';
import { doc, updateDoc, increment, setDoc, arrayUnion } from 'firebase/firestore';
import { auth } from '../services/firebase';

export const CommunityPage: React.FC<{ 
  user: UserProfile; 
  allUsers: Record<string, UserProfile>; 
  posts: CommunityPost[]; 
  onAddPost: (p: CommunityPost) => void;
  onDeletePost: (postId: string) => Promise<void>;
  pins: MapPinType[]; 
  onViewPin: (id: string) => void; 
  onViewProfile: (id: string) => void; 
  onShowNotification: (msg: string, type: 'success' | 'error' | 'warning') => void; 
  isImageDuplicate: (url: string) => boolean; 
  isLockedDown: boolean; 
  announcement: Announcement | null; 
  onAnnounceReaction: (emoji: string) => void; 
  onAnnounceReply: (text: string) => void; 
  onUpdateUser: (u: UserProfile) => void; 
  onUpdateAllUsers: (map: Record<string, UserProfile>) => void; 
  onTagUsers?: (usernames: string[]) => void;
  onToggleReaction?: (postId: string, emoji: string) => void;
  onAddReply?: (postId: string, content: string) => void;
  onDeleteReply?: (postId: string, replyId: string) => void;
  onNavigateToCrews: () => void;
  features: Record<string, boolean>;
  globalSettings?: GlobalSettings;
  userLocation?: { lat: number; lng: number } | null;
}> = ({ user, allUsers, posts, onAddPost, onDeletePost, pins, onViewPin, onViewProfile, onShowNotification, isImageDuplicate, isLockedDown, announcement, onAnnounceReaction, onAnnounceReply, onUpdateUser, onUpdateAllUsers, onTagUsers, onToggleReaction, onAddReply, onDeleteReply, onNavigateToCrews, features, globalSettings, userLocation }) => {
  const [newPostContent, setNewPostContent] = useState(''); 
  const [postImage, setPostImage] = useState<string | null>(null); 
  const [linkedPinId, setLinkedPinId] = useState<string | null>(null); 
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [showPinSelector, setShowPinSelector] = useState(false); 
  const [pinSearch, setPinSearch] = useState('');
  const [replyingToPostId, setReplyingToPostId] = useState<string | null>(null); 
  const [replyText, setReplyText] = useState(''); 
  const [taggedUsernames, setTaggedUsernames] = useState<string[]>([]);
  const [showCreator, setShowCreator] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [postToReport, setPostToReport] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [isAnnouncementExpanded, setIsAnnouncementExpanded] = useState(true);
  
  // Filtering state
  const [filterMention, setFilterMention] = useState<string | null>(null);
  const [filterAuthor, setFilterAuthor] = useState<string | null>(null);
  const [filterUrgency, setFilterUrgency] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const levelInfo = getRankInfo(user.totalXP);
  const userLevel = levelInfo.level;
  const isBlockedByWarnings = (user.warningCount || 0) > userLevel && (Date.now() - (user.lastWarningAt || 0)) < 3600000;

  const uidMap = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    Object.values(allUsers).forEach((u: any) => {
      if (u.uid) map[u.uid] = u;
    });
    return map;
  }, [allUsers]);
  
  const getUserProfile = (username: string, uid?: string) => {
    if (!uid) return allUsers[username];
    return uidMap[uid] || allUsers[username];
  };

  const handleCreatePost = async () => {
    if (isLockedDown) { onShowNotification("Posting disabled.", "warning"); return; } 
    if (isBlockedByWarnings) { onShowNotification("Too many warnings. Action blocked for 1 hour.", "error"); return; }

    const today = getLocalDateString();
    const isNewDay = user.lastActionDate !== today;
    const currentDailyPosts = isNewDay ? 0 : (user.dailyPostsCount || 0);
    const currentDailyPins = isNewDay ? 0 : (user.dailyPinsCount || 0);
    const totalDailyActions = currentDailyPosts + currentDailyPins;
    const maxDailyActions = userLevel;

    if (totalDailyActions >= maxDailyActions) {
      onShowNotification(`Daily limit reached! Level ${userLevel} users can post/pin ${maxDailyActions} times total per day.`, "warning");
      return;
    }

    if (!newPostContent.trim() && !postImage) { onShowNotification("Post must have content or image!", "error"); return; }
    
    setIsSubmitting(true); 
    const timestamp = Date.now();
    const postId = `${user.username}_${timestamp}`;
    const currentUid = user.uid || auth.currentUser?.uid || '';
    
    const newPost: CommunityPost = { 
      id: postId, 
      userId: currentUid, 
      username: user.username, 
      userProfilePicture: user.profilePicture, 
      content: newPostContent.trim(), 
      timestamp: timestamp, 
      imageUrl: postImage || undefined, 
      linkedPinId: linkedPinId || undefined, 
      reactions: {}, 
      replies: [], 
      taggedUsernames: (Array.isArray(taggedUsernames) && taggedUsernames.length > 0) ? taggedUsernames : undefined,
      borderStyle: user.selectedPostBorder,
      lat: userLocation?.lat || undefined,
      lng: userLocation?.lng || undefined
    };
    
    if (!features.community) {
      onShowNotification("Community posts are currently unavailable.", "error");
      setIsSubmitting(false);
      return;
    }
    onAddPost(newPost); 
    onUpdateUser({ 
      ...user, 
      postsCount: (user.postsCount || 0) + 1,
      linkedPostsCount: linkedPinId ? (user.linkedPostsCount || 0) + 1 : user.linkedPostsCount,
      lastActionDate: today,
      dailyPostsCount: currentDailyPosts + 1,
      dailyPinsCount: currentDailyPins
    });

    onShowNotification(`Post shared!`, "success"); 
    setNewPostContent(''); setPostImage(null); setLinkedPinId(null); setTaggedUsernames([]); setIsSubmitting(false); setShowCreator(false);
  };

  const getPostBorderClass = (borderId?: string) => {
    if (borderId === 'pb_vines_simple') return 'post-border-vines';
    if (borderId === 'pb_flowers') return 'post-border-flowers';
    if (borderId === 'pb_emerald_mist') return 'post-border-emerald-mist';
    return '';
  };

  const handleAddPostReply = (postId: string) => {
    if (onAddReply && replyText.trim()) {
      onAddReply(postId, replyText);
      setReplyText('');
      setReplyingToPostId(null);
    }
  };

  const handleAddAnnounceReply = () => {
    if (onAnnounceReply && replyText.trim()) {
      onAnnounceReply(replyText);
      setReplyText('');
      setReplyingToPostId(null);
    }
  };

  const handleReportPost = async (reason: string) => {
    if (!postToReport) return;
    try {
      const reportId = `${user.username}_${Date.now()}`;
      const report: ContentReport = {
        id: reportId,
        reporterId: auth.currentUser?.uid || user.id,
        reporterUsername: user.username,
        targetId: postToReport,
        targetType: 'post',
        reason,
        timestamp: Date.now(),
        status: 'pending'
      };
      await setDoc(doc(db, "moderation", reportId), report);
      await updateDoc(doc(db, "posts", postToReport), {
        reportCount: increment(1)
      });
      onShowNotification("Report submitted successfully.", "success");
    } catch (e) {
      console.error("Error reporting post:", e);
      onShowNotification("Failed to submit report.", "error");
    }
  };

  const hasActiveAnnouncement = (announcement && announcement.content && announcement.content.trim().length > 0) || globalSettings?.showPublicStats;
  const allowAnnounceComments = announcement?.allowComments !== false;
  const allowAnnounceReactions = announcement?.allowReactions !== false;

  const [isClaimingSpark, setIsClaimingSpark] = useState(false);

  const handleClaimSpark = async () => {
    if (!announcement || isClaimingSpark) return;
    const uid = user.uid || auth.currentUser?.uid;
    if (!uid) return;
    
    setIsClaimingSpark(true);
    try {
      await updateDoc(doc(db, "meta", "announcement"), {
        sparkClaimers: arrayUnion(uid)
      });
      await updateDoc(doc(db, "users", user.id), {
        sparks: increment(1)
      });
      onUpdateUser({ ...user, sparks: (user.sparks || 0) + 1 });
      onShowNotification("You claimed a free spark!", "success");
    } catch (error) {
      console.error("Error claiming spark:", error);
      onShowNotification("Failed to claim spark.", "error");
    } finally {
      setIsClaimingSpark(false);
    }
  };

  const isPinAvailable = announcement?.linkedPinId ? pins.some(p => p.id === announcement.linkedPinId) : true;

  const selectablePins = useMemo(() => {
    return pins
      .filter(p => 
        p.status !== 'cleaned' && (
          p.description.toLowerCase().includes(pinSearch.toLowerCase()) || 
          p.username.toLowerCase().includes(pinSearch.toLowerCase())
        )
      )
      .sort((a, b) => {
        const aMine = a.username === user.username;
        const bMine = b.username === user.username;
        if (aMine && !bMine) return -1;
        if (!aMine && bMine) return 1;
        return b.timestamp - a.timestamp;
      });
  }, [pins, pinSearch, user.username]);

  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      // Author filter
      if (filterAuthor) {
          if (post.username !== filterAuthor) return false;
      }
      
      // Mention filter
      if (filterMention) {
        if (!Array.isArray(post.taggedUsernames) || !post.taggedUsernames.includes(filterMention)) return false;
      }
      
      // Pin Level (Urgency) filter
      if (filterUrgency) {
        if (filterUrgency === 'none') {
          if (post.linkedPinId) return false;
        } else {
          if (!post.linkedPinId) return false;
          const linkedPin = pins.find(p => p.id === post.linkedPinId);
          if (linkedPin?.urgency !== filterUrgency) return false;
        }
      }
      
      return true;
    });
  }, [posts, filterMention, filterAuthor, filterUrgency, pins]);

  const allAvailableTags = useMemo(() => {
    const tags = new Set<string>();
    (Object.values(allUsers) as UserProfile[]).forEach(u => {
      u.tags?.forEach(t => tags.add(t));
    });
    return Array.from(tags);
  }, [allUsers]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic size check before processing (e.g. skip > 10MB)
    if (file.size > 10 * 1024 * 1024) {
      onShowNotification("Image too large. Please choose a smaller one.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const compressed = await compressImage(event.target?.result as string);
      setPostImage(compressed);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-4 space-y-6 pb-6 relative min-h-full bg-transparent">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Community</h2>
        {features.crews && (
          <button 
            onClick={onNavigateToCrews}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Users size={14} />
            Cleanup Crews
          </button>
        )}
      </div>

      {hasActiveAnnouncement && (
        <div className={`bg-secondary/30 border-2 border-secondary/40 rounded-[2.5rem] shadow-xl relative overflow-hidden animate-fade-in ring-4 ring-secondary/10 transition-all duration-300 ${isAnnouncementExpanded ? 'p-6' : 'p-3'}`}>
          {!isAnnouncementExpanded ? (
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsAnnouncementExpanded(true)}>
              <div className="flex items-center gap-3">
                <div className="bg-secondary p-1.5 rounded-lg"><Megaphone size={14} className="text-green-800" /></div>
                <p className="text-[10px] font-bold text-green-900 truncate max-w-[200px]">
                  {announcement?.content ? `${announcement.content.slice(0, 40)}...` : 'Community Impact'}
                </p>
              </div>
              <ChevronDown size={14} className="text-green-800" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2">
                    <div className="bg-secondary p-2 rounded-xl"><Megaphone size={18} className="text-green-800" /></div>
                    <span className="text-[10px] font-black uppercase text-green-600 tracking-widest">Official Announcement</span>
                 </div>
                 <div className="flex items-center gap-2">
                   {announcement.linkedPinId && (
                     <button 
                      onClick={() => {
                        const pin = pins.find(p => p.id === announcement.linkedPinId);
                        if (pin && pin.status !== 'cleaned') {
                          onViewPin(announcement.linkedPinId!);
                        } else {
                          onShowNotification("This pin is no longer active or available.", "error");
                        }
                      }} 
                      className={`px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1 transition-all ${pins.some(p => p.id === announcement.linkedPinId && p.status !== 'cleaned') ? 'bg-green-400/30 text-green-800 hover:bg-green-400/50' : 'bg-gray-400 text-white cursor-not-allowed'}`}
                     >
                        <PinIcon size={12} /> View Location
                     </button>
                   )}
                   <button onClick={() => setIsAnnouncementExpanded(false)} className="p-1 hover:bg-black/5 rounded-full text-green-800 transition-colors">
                     <ChevronUp size={18} />
                   </button>
                 </div>
              </div>
              <p className="text-sm font-bold text-gray-800 leading-relaxed mb-4 whitespace-pre-wrap">{announcement?.content}</p>
              {announcement?.imageUrl && (
                <div className="rounded-3xl overflow-hidden border-2 border-secondary/40 mb-4 shadow-sm bg-black/5">
                  <img src={announcement.imageUrl} className="w-full h-auto object-cover max-h-[300px]" alt="Alert" />
                </div>
              )}
              
              {globalSettings?.showPublicStats && (
                <div className="mt-6 p-6 bg-white/40 dark:bg-black/20 rounded-[2.5rem] border border-secondary/40 space-y-6 animate-fade-in shadow-inner relative overflow-hidden">
                  {/* Hardware-style background detail */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="bg-secondary p-2.5 rounded-2xl text-green-800 shadow-sm"><Trophy size={20} /></div>
                      <div>
                        <h3 className="font-black text-xs uppercase tracking-widest text-gray-900 dark:text-white">Community Impact</h3>
                        <p className="text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tighter">Real-time cleanup telemetry</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-secondary/20 relative z-10">
                    <LitterStatsGraph 
                      history={globalSettings.totalLitterStatsHistory || []} 
                      title="" 
                    />
                  </div>
                </div>
              )}

              {announcement?.offerFreeSpark && (
                <div className="mt-4 mb-4 flex justify-center">
                  <button
                    onClick={handleClaimSpark}
                    disabled={isClaimingSpark || announcement.sparkClaimers?.includes(user.uid || auth.currentUser?.uid || '')}
                    className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-md active:scale-95 ${
                      announcement.sparkClaimers?.includes(user.uid || auth.currentUser?.uid || '')
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-yellow-500 text-white hover:bg-yellow-400'
                    }`}
                  >
                    <Zap size={16} />
                    {announcement.sparkClaimers?.includes(user.uid || auth.currentUser?.uid || '') ? 'Spark Claimed' : 'Claim Free Spark'}
                  </button>
                </div>
              )}

              {announcement?.taggedUsernames && announcement.taggedUsernames.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4 mb-4 px-1">
                  {announcement.taggedUsernames.map(u => {
                    const taggedUser = getUserProfile(u);
                    return (
                      <div key={u} onClick={() => onViewProfile(u)} className="text-[9px] bg-green-400/20 text-green-900 px-2 py-1 rounded-lg font-black flex items-center gap-1 cursor-pointer hover:bg-green-400 hover:text-white transition-all shadow-sm active:scale-95">
                        <span>@</span>
                        <Username user={taggedUser || { username: u, id: '', totalXP: 0, availableScrap: 0, joinedAt: 0 }} />
                        {(taggedUser?.permissions?.isVerified || taggedUser?.permissions?.isCreator || taggedUser?.permissions?.isModerator || taggedUser?.permissions?.isAdmin || taggedUser?.isAdmin) && <VerifiedBadge size={10} />}
                      </div>
                    );
                  })}
                </div>
              )}
              {announcement?.content && (
                <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between pt-4 border-t border-secondary/40">
                  <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full flex-1">
                      {allowAnnounceReactions && ['👍', '❤️', '😊', '🎉', '🔥'].map(emoji => (
                        <button key={emoji} onClick={() => onToggleReaction?.(announcement.id, emoji)} className={`flex items-center justify-center gap-1 px-1 sm:px-2 py-2 sm:py-2.5 rounded-xl transition-all ${announcement.reactions?.[emoji]?.includes(user.uid || auth.currentUser?.uid || '') ? 'bg-secondary text-green-900 shadow-sm font-bold' : 'bg-secondary/20 text-green-800/60 hover:bg-secondary/40'}`}>
                          <span className="text-base sm:text-lg leading-none">{emoji}</span>
                          <span className="text-xs font-black">{announcement.reactions?.[emoji]?.length || 0}</span>
                        </button>
                      ))}
                  </div>
                  {allowAnnounceComments && (
                    <button onClick={() => setReplyingToPostId(replyingToPostId === announcement.id ? null : announcement.id)} className="w-full sm:w-auto shrink-0 bg-green-600 text-white px-4 py-2 sm:py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-md active:scale-95 transition-all text-center">
                      {replyingToPostId === announcement.id ? 'Cancel' : 'Comment'}
                    </button>
                  )}
                </div>
              )}

              {allowAnnounceComments && announcement?.content && replyingToPostId === announcement.id && (
                <div className="mt-4 p-4 bg-white/50 dark:bg-black/20 rounded-2xl animate-slide-up space-y-3">
                  <textarea 
                    autoFocus
                    className="w-full bg-white dark:bg-[#111827] border-2 border-green-600/30 rounded-xl p-3 text-xs outline-none resize-none text-gray-900 dark:text-white font-medium shadow-inner" 
                    placeholder="Add your comment..." 
                    rows={2} 
                    value={replyText} 
                    onChange={e => setReplyText(e.target.value)} 
                  />
                  <button onClick={handleAddAnnounceReply} disabled={!replyText.trim()} className="w-full bg-green-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
                    <span className="flex items-center gap-2"><Send size={12} /> Post Comment</span>
                  </button>
                </div>
              )}

              {announcement?.content && announcement.replies && announcement.replies.length > 0 && (
                <div className="mt-4 space-y-3 border-t border-secondary/40 pt-4">
                  {(() => {
                    const sortedReplies = [...(announcement.replies || [])]
                      .filter(r => getUserProfile(r.username, r.userId))
                      .sort((a, b) => b.timestamp - a.timestamp);
                    const isExpanded = expandedReplies[announcement.id];
                    const displayReplies = isExpanded ? sortedReplies : sortedReplies.slice(0, 3);
                    
                    return (
                      <>
                        {displayReplies.map(reply => {
                          const replyUser = getUserProfile(reply.username, reply.userId);
                          const displayTags = replyUser ? [...(replyUser.tags || [])] : [];
                          if (replyUser?.permissions?.isCreator) displayTags.push('Creator');
                          if (replyUser?.permissions?.isTester) displayTags.push('Tester');

                          return (
                            <div key={reply.id} className="flex gap-2 animate-fade-in">
                              <div onClick={() => onViewProfile(reply.username)} className="w-6 h-6 rounded-full overflow-hidden bg-white/50 shrink-0 cursor-pointer">
                                {(replyUser?.profilePicture || reply.userProfilePicture) ? <img src={replyUser?.profilePicture || reply.userProfilePicture} className="w-full h-full object-cover" /> : <User size={12} className="m-1.5 text-green-800/40" />}
                              </div>
                              <div className="flex-1 min-w-0 bg-white/40 rounded-xl px-3 py-2">
                                <div className="flex items-center justify-between gap-1.5 mb-0.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <p onClick={() => onViewProfile(reply.username)} className="text-[9px] font-black text-green-900 cursor-pointer hover:underline inline-block truncate">
                                      <Username user={replyUser || { username: reply.username, id: reply.userId, totalXP: 0, availableScrap: 0, joinedAt: 0 }} />
                                    </p>
                                    {(replyUser?.permissions?.isVerified || replyUser?.permissions?.isCreator || replyUser?.permissions?.isModerator || replyUser?.permissions?.isAdmin || replyUser?.isAdmin) && <VerifiedBadge size={10} />}
                                    <div className="flex flex-wrap gap-1">
                                      {displayTags.map(t => <TagBadge key={t} tag={t} />)}
                                    </div>
                                  </div>
                                  <span className="text-[8px] text-green-800/60 font-black uppercase tracking-tighter shrink-0">{formatFullTimestamp(reply.timestamp)}</span>
                                </div>
                                {replyUser?.selectedTitle && (
                                  <div className="leading-none mb-1">
                                    <TitleDisplay title={replyUser.selectedTitle} size="xs" />
                                  </div>
                                )}
                                <p className="text-[11px] text-gray-800 font-medium">{reply.content}</p>
                              </div>
                            </div>
                          );
                        })}
                        {sortedReplies.length > 3 && (
                          <button 
                            onClick={() => setExpandedReplies(prev => ({ ...prev, [announcement.id]: !isExpanded }))}
                            className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-green-800/60 hover:text-green-800 transition-colors flex items-center justify-center gap-1"
                          >
                            {isExpanded ? (
                              <>Show Less <ChevronUp size={12} /></>
                            ) : (
                              <>Show {sortedReplies.length - 3} More Replies <ChevronDown size={12} /></>
                            )}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {showCreator && (
        <div className="bg-gray-50 dark:bg-[#111827] rounded-[2.5rem] p-6 shadow-2xl border border-gray-200 dark:border-primary/20 space-y-4 animate-slide-up mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase text-primary tracking-widest">Share a Story</h3>
            <button onClick={() => setShowCreator(false)} className="text-gray-400 hover:text-red-500"><X size={18}/></button>
          </div>
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white dark:bg-gray-800 shrink-0 border border-gray-200 dark:border-gray-700">
              {user.profilePicture ? <img src={user.profilePicture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><User size={20} /></div>}
            </div>
            <textarea autoFocus className="flex-1 bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-sm outline-none resize-none text-gray-900 dark:text-gray-100 font-medium" placeholder="Write something..." rows={3} value={newPostContent} onChange={e => setNewPostContent(e.target.value)} />
          </div>

          {showPinSelector && (
            <div className="bg-white dark:bg-[#1f2937] p-4 rounded-2xl border-2 border-primary/20 space-y-3 animate-slide-up ml-12">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Select Community Pin</span>
                {linkedPinId && (
                  <button onClick={() => setLinkedPinId(null)} className="text-[9px] font-black text-red-500 uppercase tracking-widest">Clear</button>
                )}
              </div>
              
              <div className="relative mb-2">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-[10px] outline-none"
                  placeholder="Search pins or users..."
                  value={pinSearch}
                  onChange={e => setPinSearch(e.target.value)}
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                {selectablePins.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic py-2">No matching pins found.</p>
                ) : (
                  selectablePins.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => { setLinkedPinId(p.id); setShowPinSelector(false); }}
                      className={`shrink-0 w-32 p-3 rounded-xl border-2 transition-all text-left ${linkedPinId === p.id ? 'border-primary bg-primary/5' : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'}`}
                    >
                      <p className="text-[10px] font-black text-gray-800 dark:text-gray-100 truncate mb-0.5">{p.description}</p>
                      <p className="text-[8px] text-primary font-black uppercase tracking-tighter truncate mb-1">@{p.username}</p>
                      <p className="text-[7px] text-gray-400 font-bold uppercase tracking-tighter">{new Date(p.timestamp).toLocaleDateString()}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 ml-12">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${!!postImage ? 'bg-primary border-primary text-white hover:bg-primary/90' : 'bg-gray-100 dark:bg-[#1f2937] border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`} 
                type="button"
                title="Add Image"
              >
                <ImageIcon size={20} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
              
              <button 
                onClick={() => setShowPinSelector(!showPinSelector)} 
                className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${!!linkedPinId || showPinSelector ? 'bg-primary border-primary text-white hover:bg-primary/90' : 'bg-gray-100 dark:bg-[#1f2937] border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`} 
                type="button"
                title="Link Pin"
              >
                <LinkIcon size={20} />
              </button>

              <UserTagPicker 
                allUsers={allUsers} 
                currentUser={user} 
                selectedUsernames={taggedUsernames} 
                onToggleUser={u => setTaggedUsernames(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u])} 
                variant="icon" 
                buddyIds={user.friends}
                triggerIcon={<Tag size={20} />}
                triggerClassName={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer shrink-0 ${taggedUsernames.length > 0 ? 'bg-primary border-primary text-white hover:bg-primary/90' : 'bg-gray-100 dark:bg-[#1f2937] border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
              />
            </div>
            <button onClick={handleCreatePost} disabled={isSubmitting || (!newPostContent.trim() && !postImage)} className="bg-primary text-white px-8 py-2.5 rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20 disabled:opacity-50 transition-all hover:scale-105 active:scale-95">{isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Post'}</button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Stories</h3>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showFilters || filterMention || filterUrgency ? 'bg-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200'}`}
          >
            <Search size={14} />
            {showFilters ? 'Hide Filters' : 'Filter Stories'}
            {(filterMention || filterUrgency) && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}
          </button>
        </div>

        {showFilters && (
          <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm animate-slide-up space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-3">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Filter by Mention</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Search @username..."
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      value={filterMention || ''}
                      onChange={(e) => setFilterMention(e.target.value.replace('@', '').trim() || null)}
                    />
                  </div>
                  <button 
                    onClick={() => setFilterMention(user.username)}
                    className={`px-4 rounded-2xl text-[10px] font-black uppercase transition-all ${filterMention === user.username ? 'bg-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200'}`}
                  >
                    Me
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Filter by Author</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Search author username..."
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      value={filterAuthor || ''}
                      onChange={(e) => setFilterAuthor(e.target.value.trim() || null)}
                    />
                  </div>
                  <button 
                    onClick={() => setFilterAuthor(user.username)}
                    className={`px-4 rounded-2xl text-[10px] font-black uppercase transition-all ${filterAuthor === user.username ? 'bg-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200'}`}
                  >
                    Me
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Filter by Pin Level</label>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => setFilterUrgency(null)}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!filterUrgency ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setFilterUrgency('none')}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterUrgency === 'none' ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
                  >
                    No Pin
                  </button>
                  {['light', 'moderate', 'extreme'].map(u => (
                    <button 
                      key={u}
                      onClick={() => setFilterUrgency(u)}
                      className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterUrgency === u ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {(filterMention || filterAuthor || filterUrgency) && (
              <button 
                onClick={() => { setFilterMention(null); setFilterAuthor(null); setFilterUrgency(null); }}
                className="w-full py-3 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}

        {filteredPosts.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-800 animate-fade-in">
            <p className="text-gray-400 font-bold italic">No stories match your filters.</p>
            <button 
              onClick={() => { setFilterMention(null); setFilterUrgency(null); }}
              className="mt-4 text-primary font-black text-[10px] uppercase tracking-widest hover:underline"
            >
              Reset Filters
            </button>
          </div>
        ) : filteredPosts.map(post => {
          const isReplying = replyingToPostId === post.id;
          const postUser = getUserProfile(post.username, post.userId);
          const isOwnPost = (auth.currentUser && post.userId === auth.currentUser.uid) || (post.username === user.username);
          
          const displayTags = postUser ? [...(postUser.tags || [])] : [];
          if (postUser?.permissions?.isCreator) displayTags.push('Creator');
          if (postUser?.permissions?.isTester) displayTags.push('Tester');

          return (
            <div key={post.id} className={`bg-white dark:bg-[#1f2937] rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden animate-fade-in ${getPostBorderClass(postUser?.selectedPostBorder || post.borderStyle)}`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div onClick={() => onViewProfile(post.username)} className="flex items-center gap-3 cursor-pointer group">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-gray-700 group-hover:ring-2 ring-primary transition-all shrink-0">
                      {(postUser?.profilePicture || post.userProfilePicture) ? <img src={postUser?.profilePicture || post.userProfilePicture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500"><User size={20} /></div>}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-black text-gray-800 dark:text-gray-100 group-hover:text-primary transition-colors flex items-center gap-0.5">
                          <span>@</span>
                          <Username user={postUser || { username: post.username, id: post.userId, totalXP: 0, availableXP: 0, joinedAt: 0 }} />
                        </h4>
                        { (postUser?.permissions?.isVerified || postUser?.permissions?.isCreator || postUser?.permissions?.isModerator || postUser?.permissions?.isAdmin || postUser?.isAdmin) && <VerifiedBadge size={14} />}
                        <div className="flex flex-wrap gap-1">
                          {displayTags.map(t => <TagBadge key={t} tag={t} />)}
                        </div>
                      </div>
                      {postUser?.selectedTitle && (
                        <div className="leading-none mt-0.5">
                          <TitleDisplay title={postUser.selectedTitle} size="xs" />
                        </div>
                      )}
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mt-1">{formatFullTimestamp(post.timestamp)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwnPost && <button onClick={(e) => { e.stopPropagation(); setPostToDelete(post.id); }} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>}
                    {!isOwnPost && <button onClick={(e) => { e.stopPropagation(); setPostToReport(post.id); }} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Report Post"><AlertTriangle size={16} /></button>}
                    {post.linkedPinId && (
                      <button 
                        onClick={() => {
                          const pin = pins.find(p => p.id === post.linkedPinId);
                          if (pin && pin.status !== 'cleaned') {
                            onViewPin(post.linkedPinId!);
                          } else {
                            onShowNotification("This pin is no longer active or available.", "error");
                          }
                        }} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${pins.some(p => p.id === post.linkedPinId && p.status !== 'cleaned') ? 'bg-primary/10 text-primary hover:bg-primary hover:text-white' : 'bg-gray-400 text-white cursor-not-allowed'}`}
                      >
                        <PinIcon size={12} /> Pin
                      </button>
                    )}
                  </div>
                </div>
                {post.content && <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4 font-medium">{post.content}</p>}
                {post.imageUrl && (
                  <div className="rounded-[2rem] overflow-hidden border border-gray-100 dark:border-gray-800 mb-4 bg-gray-50 dark:bg-black/20">
                    <img src={post.imageUrl} className="w-full h-auto object-cover max-h-[400px]" alt="Post" />
                  </div>
                )}

                {post.taggedUsernames && post.taggedUsernames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4 px-1">
                    {post.taggedUsernames.map(u => {
                      const taggedUser = getUserProfile(u);
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

                <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between mt-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full flex-1">
                    {['👍', '❤️', '😊', '🎉', '🔥'].map(emoji => (
                      <button key={emoji} onClick={() => onToggleReaction?.(post.id, emoji)} className={`flex items-center justify-center gap-1 px-1 sm:px-2 py-2 sm:py-2.5 rounded-xl transition-all ${post.reactions?.[emoji]?.includes(user.uid || auth.currentUser?.uid || '') ? 'bg-primary text-white shadow-md' : 'bg-gray-50 dark:bg-[#111827] text-gray-500 hover:text-primary hover:bg-primary/10 border border-gray-100 dark:border-gray-800'}`}>
                        <span className="text-base sm:text-lg leading-none">{emoji}</span>
                        <span className="text-xs font-black">{post.reactions?.[emoji]?.length || 0}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setReplyingToPostId(isReplying ? null : post.id)} className={`w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 sm:py-2.5 rounded-xl transition-all ${isReplying ? 'bg-gray-500 text-white' : 'bg-primary text-white shadow-lg shadow-primary/20'}`}>
                    <MessageCircle size={16} />
                    <span className="text-xs font-black uppercase tracking-wider">{isReplying ? 'Cancel' : 'Comment'}</span>
                  </button>
                </div>

                {isReplying && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-[#111827] rounded-2xl animate-slide-up space-y-3">
                    <textarea 
                      autoFocus
                      className="w-full bg-white dark:bg-[#1f2937] border-2 border-primary/20 rounded-xl p-3 text-xs outline-none resize-none text-gray-900 dark:text-white font-medium shadow-inner" 
                      placeholder="Share your thoughts..." 
                      rows={2} 
                      value={replyText} 
                      onChange={e => setReplyText(e.target.value)} 
                    />
                    <button onClick={() => handleAddPostReply(post.id)} disabled={!replyText.trim()} className="w-full bg-primary text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
                      <span className="flex items-center gap-2"><Send size={12} /> Send Comment</span>
                    </button>
                  </div>
                )}

                {post.replies && post.replies.length > 0 && (
                  <div className="mt-4 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4">
                    {(() => {
                      const sortedReplies = [...(post.replies || [])]
                        .filter(r => getUserProfile(r.username, r.userId))
                        .sort((a, b) => b.timestamp - a.timestamp);
                      const isExpanded = expandedReplies[post.id];
                      const displayReplies = isExpanded ? sortedReplies : sortedReplies.slice(0, 3);

                      return (
                        <>
                          {displayReplies.map(reply => {
                            const replyUser = getUserProfile(reply.username, reply.userId);
                            const isOwnReply = (auth.currentUser && reply.userId === auth.currentUser.uid) || (reply.username === user.username);
                            const isPostOwner = (auth.currentUser && post.userId === auth.currentUser.uid) || (post.username === user.username);
                            
                            const replyTags = replyUser ? [...(replyUser.tags || [])] : [];
                            if (replyUser?.permissions?.isCreator) replyTags.push('Creator');
                            if (replyUser?.permissions?.isTester) replyTags.push('Tester');

                            return (
                              <div key={reply.id} className="flex gap-2 animate-fade-in">
                                <div onClick={() => onViewProfile(reply.username)} className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 shrink-0 cursor-pointer">
                                  {(replyUser?.profilePicture || reply.userProfilePicture) ? <img src={replyUser?.profilePicture || reply.userProfilePicture} className="w-full h-full object-cover" /> : <User size={12} className="m-1.5 text-gray-400" />}
                                </div>
                                <div className="flex-1 min-w-0 bg-gray-50 dark:bg-[#111827] rounded-xl px-3 py-2">
                                  <div className="flex items-center justify-between gap-1.5 mb-0.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <p onClick={() => onViewProfile(reply.username)} className="text-[9px] font-black text-primary cursor-pointer hover:underline inline-block truncate">
                                        <Username user={replyUser || { username: reply.username, id: reply.userId, totalXP: 0, availableXP: 0, joinedAt: 0 }} />
                                      </p>
                                      {replyUser?.permissions?.isVerified && <VerifiedBadge size={10} />}
                                      <div className="flex flex-wrap gap-1">
                                        {replyTags.map(t => <TagBadge key={t} tag={t} />)}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[8px] text-gray-400 font-black uppercase tracking-tighter">{formatFullTimestamp(reply.timestamp)}</span>
                                      {(isOwnReply || isPostOwner) && (
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); onDeleteReply?.(post.id, reply.id); }} 
                                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                          <Trash2 size={10} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {replyUser?.selectedTitle && (
                                    <div className="leading-none mb-1">
                                      <TitleDisplay title={replyUser.selectedTitle} size="xs" />
                                    </div>
                                  )}
                                  <p className="text-[11px] text-gray-700 dark:text-gray-300 font-medium">{reply.content}</p>
                                </div>
                              </div>
                            );
                          })}
                          {sortedReplies.length > 3 && (
                            <button 
                              onClick={() => setExpandedReplies(prev => ({ ...prev, [post.id]: !isExpanded }))}
                              className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-primary transition-colors flex items-center justify-center gap-1"
                            >
                              {isExpanded ? (
                                <>Show Less <ChevronUp size={12} /></>
                              ) : (
                                <>Show {sortedReplies.length - 3} More Replies <ChevronDown size={12} /></>
                              )}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="fixed bottom-28 left-0 right-0 max-w-7xl mx-auto pointer-events-none z-40">
        <div className="flex justify-center">
          {!isLockedDown && (
            <button onClick={() => setShowCreator(!showCreator)} className={`pointer-events-auto w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all border-4 border-white dark:border-[#111827] ${showCreator ? 'bg-red-500 rotate-45' : 'bg-primary hover:scale-110 active:scale-95'}`} type="button">
              <Plus size={32} className="text-white" />
            </button>
          )}
        </div>
      </div>

      <ConfirmModal 
        title="Delete Post?" 
        message="This action cannot be undone."
        confirmText="Delete"
        onConfirm={() => { if(postToDelete) { onDeletePost(postToDelete); setPostToDelete(null); } }}
        onCancel={() => setPostToDelete(null)}
        isOpen={!!postToDelete}
      />
      
      <ReportModal 
        isOpen={!!postToReport} 
        onClose={() => setPostToReport(null)} 
        onSubmit={handleReportPost} 
      />
    </div>
  );
};