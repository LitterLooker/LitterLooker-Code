import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, ArrowRight, X, Trash, Megaphone, MapPin as PinIcon, MessageSquare, Tag, ChevronUp, ChevronDown, UserPlus, Coins, Zap, ChevronRight, Sparkles, Heart, Recycle, Users, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, MapPin, CommunityPost, Announcement, MultiplierZone, GroupCleanup, GlobalSettings } from '../types';
import { VerifiedBadge } from './VerifiedBadge';
import { ScrapChart } from './ScrapChart';
import { ACHIEVEMENTS_DATA, RANK_SYSTEM, INFINITY_XP, INFINITY_SYMBOL } from '../constants';
import { getRankInfo, getRankIconPath, convertWeight, convertArea, getWeightUnit, getAreaUnit, getUserFirstName } from '../utils';
import { DailyQuestionTile } from './DailyQuestionTile';
import { Username } from './Username';

export const HomePage: React.FC<{ 
  user: UserProfile; 
  onShowRankPath: () => void; 
  onShowWorldRankings: () => void;
  missedPins: MapPin[]; 
  missedCleanups?: GroupCleanup[];
  missedPosts: CommunityPost[]; 
  missedAnnouncement: Announcement[]; 
  onJumpToPin: (id: string) => void; 
  onJumpToFeed: (id?: string) => void; 
  onDismissMissed: (id: string) => void; 
  onClearAllMissed: () => void; 
  onViewAchievements: () => void; 
  onClaimLeaderboardReward: () => void; 
  onViewFriends: () => void;
  onViewRewards: () => void;
  onViewCleanupCrews: (teamId?: string) => void;
  allUsers: Record<string, UserProfile>; 
  onCheckWelcomeBack: (count: number) => void; 
  activeZone: MultiplierZone | null;
  features: Record<string, boolean>;
  globalSettings: GlobalSettings | null;
  onAnswerDailyQuestion: (history: any[], timeLeft: number) => Promise<void>;
  onEndChallenge: (corrects: number, reward: number, history: any[]) => Promise<void>;
  onUseSpark?: () => Promise<void>;
  dismissedMissedIds?: string[];
}> = ({ user, onShowRankPath, onShowWorldRankings, missedPins, missedCleanups = [], missedPosts, missedAnnouncement, onJumpToPin, onJumpToFeed, onDismissMissed, onClearAllMissed, onViewAchievements, onClaimLeaderboardReward, onViewFriends, onViewRewards, onViewCleanupCrews, allUsers, onCheckWelcomeBack, activeZone, features, globalSettings, onAnswerDailyQuestion, onEndChallenge, onUseSpark, dismissedMissedIds = [] }) => {
  const [greeting, setGreeting] = useState(''); 
  
  useEffect(() => { 
    const hour = new Date().getHours(); 
    if (hour < 12) setGreeting('GOOD MORNING'); 
    else if (hour < 18) setGreeting('GOOD AFTERNOON'); 
    else setGreeting('GOOD EVENING'); 
  }, []);

  const combinedMissed = useMemo(() => { 
    const items = [ 
      ...(user.pendingLeaderboardReward ? [{ type: 'leaderboard' as const, id: 'lb_reward', content: `Season Reward Ready!`, timestamp: Date.now(), icon: <Trophy className="text-white" size={18} />, color: 'bg-green-600', user: undefined, tag: false }] : []), 
      ...missedAnnouncement.map(a => ({ type: 'announcement' as const, id: a.id, content: a.content, timestamp: a.timestamp, icon: <Megaphone size={18} />, color: 'bg-secondary/40 text-green-700 dark:text-green-400', user: undefined, tag: false })), 
      ...(user.friendRequests || []).map(r => ({ type: 'friend' as const, id: `friend_${r.fromUserId}`, content: `Friend request from @${r.fromUsername}`, timestamp: r.timestamp, icon: <UserPlus className="text-white" size={18} />, color: 'bg-primary', user: r.fromUsername, tag: false })),
      ...(user.crewInvites || []).map(i => ({ type: 'crew_invite' as const, id: `crew_invite_${i.teamId}`, content: `Invited to join @${i.teamName}`, timestamp: i.timestamp, icon: <Users className="text-white" size={18} />, color: 'bg-primary', user: i.fromUsername, tag: false })),
      ...(features.pins ? missedPins.map(p => { 
        const isTagged = p.progressReports?.some(pr => pr.taggedUsernames?.includes(user.username)); 
        return { type: 'pin' as const, id: p.id, content: p.description, timestamp: p.timestamp, user: p.username, icon: isTagged ? <Tag size={18} /> : <PinIcon size={18} />, color: 'bg-primary/20 text-primary', tag: isTagged }; 
      }) : []), 
      ...(features.scheduling ? missedCleanups.map(c => ({
        type: 'cleanup' as const,
        id: c.id,
        content: `New Cleanup: ${c.title || 'Group Event'}`,
        timestamp: c.timestamp,
        user: c.creatorUsername,
        icon: <Recycle size={18} />,
        color: 'bg-secondary/20 text-green-700 dark:text-green-400',
        tag: false
      })) : []),
      ...(features.community ? missedPosts.map(p => { 
        const isTagged = p.taggedUsernames?.includes(user.username); 
        return { type: 'post' as const, id: p.id, content: p.content || 'Shared an update', timestamp: p.timestamp, user: p.username, icon: isTagged ? <Tag size={18} /> : <MessageSquare size={18} />, color: 'bg-green-400/20 text-green-600 dark:text-green-400', tag: isTagged }; 
      }) : []),
    ]; 

    // Ensure unique IDs to prevent duplicate key errors
    const uniqueItems: any[] = [];
    const seenIds = new Set();
    for (const item of items) {
      if (!seenIds.has(item.id)) {
        uniqueItems.push(item);
        seenIds.add(item.id);
      }
    }

    return uniqueItems
      .filter(item => !dismissedMissedIds.includes(item.id))
      .sort((a, b) => b.timestamp - a.timestamp); 
  }, [user.pendingLeaderboardReward, missedAnnouncement, missedPins, missedCleanups, missedPosts, user.username, user.friendRequests, user.crewInvites, features, dismissedMissedIds]);
  
  const [showAllMissed, setShowAllMissed] = useState(false);
  const displayedMissed = showAllMissed ? combinedMissed : combinedMissed.slice(0, 3);

  const visibleAchievements = ACHIEVEMENTS_DATA.filter(a => !a.hidden);
  const completedVisibleCount = (user.completedAchievements || []).filter(id => {
    const ach = ACHIEVEMENTS_DATA.find(a => a.id === id);
    return ach && !ach.hidden;
  }).length;
  const totalVisibleCount = visibleAchievements.length;

  const currentRank = getRankInfo(user.totalXP);
  const nextRank = RANK_SYSTEM.find(r => r.level === currentRank.level + 1);
  const isMaxLevel = currentRank.level >= 15 || user.totalXP === INFINITY_XP || user.totalXP === -1;
  const rawXP = typeof user.totalXP === 'number' ? user.totalXP : 0;
  const progressPercent = isMaxLevel 
    ? 100 
    : nextRank 
      ? Math.min(100, Math.max(0, ((rawXP - currentRank.threshold) / ((nextRank.threshold - currentRank.threshold) || 1)) * 100))
      : 100;
  const isNearingMax = !isMaxLevel && progressPercent >= 80;

  const firstName = getUserFirstName(user);
  const fullGreetingLen = (greeting ? `${greeting}, ${firstName}!` : '').length;
  const greetingFontSizeClass = useMemo(() => {
    if (fullGreetingLen <= 22) return 'text-xl sm:text-2xl';
    if (fullGreetingLen <= 28) return 'text-lg sm:text-xl';
    if (fullGreetingLen <= 36) return 'text-base sm:text-lg';
    if (fullGreetingLen <= 45) return 'text-sm sm:text-base';
    return 'text-xs sm:text-sm';
  }, [fullGreetingLen]);

  return (
    <div className="flex flex-col min-h-full bg-transparent relative">
      <main className="flex-1 p-4 space-y-4 animate-fade-in relative z-10">
        <div className="text-center overflow-hidden">
          <h2 className={`${greetingFontSizeClass} font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none whitespace-nowrap truncate max-w-full px-1`}>
            {greeting}, <Username user={user} firstNameOnly={true} className="uppercase" />!
          </h2>
          <p className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1">Ready to Mend The Earth?</p>
        </div>

        {features.daily && (
          <DailyQuestionTile 
            user={user} 
            allUsers={allUsers} 
            onAnswer={onAnswerDailyQuestion} 
            onEndChallenge={onEndChallenge} 
            onUseSpark={onUseSpark}
          />
        )}


        {activeZone && (
          <div className="bg-gradient-to-r from-primary to-green-600 p-6 rounded-[2.5rem] text-white shadow-xl animate-pulse ring-4 ring-primary/20 relative overflow-hidden">
            <Sparkles className="absolute -top-1 -right-1 text-white/20" size={80} />
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2">You are in a bonus area!</div>
              <h3 className="text-2xl font-black uppercase tracking-tighter">🔥 {activeZone.multiplier}x SCRAP AREA</h3>
              {activeZone.title && <p className="text-sm font-black uppercase tracking-widest mt-1 text-white/90">« {activeZone.title} »</p>}
              <p className="text-[9px] font-bold uppercase opacity-80 mt-2">Earn massive XP bonuses for mending this area!</p>
            </div>
          </div>
        )}

        {features.crews && currentRank.level >= 3 && (
            <button 
              onClick={() => onViewCleanupCrews()}
              className="w-full bg-gray-50 dark:bg-[#1f2937] p-4 rounded-[2rem] border border-gray-100 dark:border-gray-700 flex items-center justify-between transition-all group shadow-sm hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform bg-primary/10 text-primary group-hover:scale-110">
                  <Users size={20} />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tighter">Cleanup Crews</h3>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    Collaborate & Compete
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>
        )}

   <div 
          className={`w-full bg-gray-50 dark:bg-[#1f2937] rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden relative ${isNearingMax ? 'ring-4 ring-primary/20 shadow-[0_0_20px_rgba(34,197,94,0.2)] animate-pulse-subtle' : ''}`}
        >
          <div 
            onClick={onShowRankPath}
            className="p-5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-full overflow-hidden shrink-0">
                  <img src={getRankIconPath(currentRank.name)} alt={currentRank.name} className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Current Level Progress</p>
                  <h3 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tighter leading-tight">
                    {currentRank.name}
                  </h3>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="w-full h-3 rounded-full overflow-hidden relative border border-white/10 dark:border-black/30 bg-gray-200 dark:bg-gray-800">
                <div 
                  className="absolute top-0 left-0 h-full transition-all duration-1000 ease-out rounded-full"
                  style={{ 
                    width: `${isMaxLevel ? 100 : progressPercent}%`,
                    background: 'linear-gradient(to right, #9ca3af, #22C55E)'
                  }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-black text-gray-500 uppercase tracking-widest">
                {isMaxLevel ? (
                  <span className="text-primary font-black">★ Maximum Level Reached</span>
                ) : (
                  <span>Level {currentRank.level}</span>
                )}
                <span>
                  {user.totalXP === INFINITY_XP || user.totalXP === -1 ? INFINITY_SYMBOL : (user.totalXP || 0).toLocaleString()} / {nextRank ? nextRank.threshold.toLocaleString() : 'MAX'} XP
                </span>
              </div>
            </div>
          </div>

          <button 
            onClick={onViewAchievements}
            className="w-full py-3 px-5 border-t border-gray-100 dark:border-gray-700 text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-green-600" />
              <span>Achievements</span>
            </div>
            <span>{completedVisibleCount}/{totalVisibleCount}</span>
          </button>
          <button 
            onClick={onViewRewards}
            className="w-full py-3 px-5 border-t border-gray-100 dark:border-gray-700 text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Coins size={14} className="text-primary" />
              <span>Rewards Shop</span>
            </div>
            <span>{user.totalXP === INFINITY_XP ? INFINITY_SYMBOL : (user.availableScrap || 0).toLocaleString()} SCRAP</span>
          </button>
        </div>
        <div className="w-full pt-4 flex flex-col gap-4">
          <div className="bg-white dark:bg-gray-800/50 rounded-3xl p-4 border dark:border-gray-700 space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-xl text-primary"><Zap size={16} /></div>
              <h3 className="font-black text-xs uppercase tracking-widest text-gray-800 dark:text-white">Resources</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border dark:border-gray-700 flex flex-col items-center justify-center shrink-0 min-w-0">
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5 truncate">XP</p>
                <p className="font-black text-gray-800 dark:text-white w-full text-center" style={{ fontSize: 'clamp(0.5rem, 4vw, 1rem)' }}>{user.totalXP === INFINITY_XP ? INFINITY_SYMBOL : user.totalXP.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border dark:border-gray-700 flex flex-col items-center justify-center shrink-0 min-w-0">
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5 truncate">Scrap</p>
                <p className="font-black text-gray-800 dark:text-white w-full text-center" style={{ fontSize: 'clamp(0.5rem, 4vw, 1rem)' }}>
                  {user.totalXP === INFINITY_XP ? INFINITY_SYMBOL : (user.availableScrap?.toLocaleString() || 0)}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border dark:border-gray-700 flex flex-col items-center justify-center shrink-0 min-w-0">
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5 truncate">Sparks</p>
                <p className="font-black text-gray-800 dark:text-white w-full text-center" style={{ fontSize: 'clamp(0.5rem, 4vw, 1rem)' }}>{user.sparks || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/50 rounded-3xl p-4 border dark:border-gray-700 space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-xl text-primary"><Trophy size={16} /></div>
              <h3 className="font-black text-xs uppercase tracking-widest text-gray-800 dark:text-white">Legacy</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div 
                onClick={onShowWorldRankings}
                className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border dark:border-gray-700 flex flex-col items-center justify-center shrink-0 min-w-0 cursor-pointer hover:scale-105 transition-transform"
              >
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5 truncate">Weight</p>
                <p className="font-black text-gray-800 dark:text-white w-full text-center leading-none" style={{ fontSize: 'clamp(0.5rem, 4vw, 1rem)' }}>
                  {convertWeight(user.litterStats?.weightKg || 0, user.measurementSystem || 'metric').toFixed(1)}
                </p>
                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">
                  {getWeightUnit(user.measurementSystem || 'metric')}
                </p>
                {user.globalRank_weight && (
                  <p className="text-[7px] font-black text-primary uppercase tracking-tighter mt-0.5 truncate">Rank #{user.globalRank_weight}</p>
                )}
              </div>
              <div 
                onClick={onShowWorldRankings}
                className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border dark:border-gray-700 flex flex-col items-center justify-center shrink-0 min-w-0 cursor-pointer hover:scale-105 transition-transform"
              >
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5 truncate">Area</p>
                <p className="font-black text-gray-800 dark:text-white w-full text-center leading-none" style={{ fontSize: 'clamp(0.5rem, 4vw, 1rem)' }}>
                  {convertArea(user.litterStats?.areaSqM || 0, user.measurementSystem || 'metric').toFixed(1)}
                </p>
                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">
                  {getAreaUnit(user.measurementSystem || 'metric')}
                </p>
                {user.globalRank_area && (
                  <p className="text-[7px] font-black text-primary uppercase tracking-tighter mt-0.5 truncate">Rank #{user.globalRank_area}</p>
                )}
              </div>
                <div 
                onClick={onShowWorldRankings}
                className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border dark:border-gray-700 flex flex-col items-center justify-center shrink-0 min-w-0 cursor-pointer hover:scale-105 transition-transform"
              >
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5 truncate">Pieces</p>
                <p className="font-black text-gray-800 dark:text-white w-full text-center leading-none" style={{ fontSize: 'clamp(0.5rem, 4vw, 1rem)' }}>
                  {(user.litterStats?.piecesCount || 0).toLocaleString()}
                </p>
                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">
                    Pieces
                </p>
                {user.globalRank_pieces && (
                  <p className="text-[7px] font-black text-primary uppercase tracking-tighter mt-0.5 truncate">Rank #{user.globalRank_pieces}</p>
                )}
              </div>
            </div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center">AI Estimated</p>
          </div>
          <ScrapChart user={user} allUsers={allUsers} />
        </div>
        {combinedMissed.length > 0 && (
          <div className="animate-fade-in text-left">
            <div className="flex justify-between items-center mb-4 px-2">
              <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] flex items-center gap-2">
                <Megaphone size={12} className="text-primary" /> Activity
              </h3>
              <button onClick={onClearAllMissed} className="text-[10px] font-black uppercase text-red-500 dark:text-red-400 flex items-center gap-1.5" type="button">
                <Trash size={12} /> Clear
              </button>
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {displayedMissed.map(item => (
                  <motion.div 
                    key={item.id} 
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, x: -100 }}
                    className="relative rounded-3xl overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-red-500 flex items-center justify-end px-6 rounded-3xl">
                      <Trash className="text-white" size={20} />
                    </div>
                    <motion.div
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.7}
                      onDragEnd={(e, info) => {
                        if (info.offset.x < -75 || info.offset.x > 75) {
                          onDismissMissed(item.id);
                        }
                      }}
                      className="relative z-10 w-full"
                    >
                      <button onClick={() => { 
                        onDismissMissed(item.id);
                        if (item.type === 'pin') onJumpToPin(item.id); 
                        else if (item.type === 'announcement') onJumpToFeed(); 
                        else if (item.type === 'leaderboard') onClaimLeaderboardReward(); 
                        else if (item.type === 'friend') onViewFriends();
                        else if (item.type === 'crew_invite') {
                          const teamId = item.id.replace('crew_invite_', '');
                          onViewCleanupCrews(teamId);
                        }
                        else onJumpToFeed(item.id); 
                      }} className="w-full bg-gray-50 dark:bg-[#1f2937] p-4 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4 text-left transition-all hover:bg-gray-100 dark:hover:bg-[#374151]" type="button">
                        <div className={`p-2.5 rounded-2xl shrink-0 ${item.color}`}>{item.icon}</div>
                        <div className="flex-1 min-w-0 pr-6">
                          <div className="text-xs font-black text-gray-800 dark:text-gray-100 truncate">{item.content}</div>
                          {item.user && (
                            <div className="text-[9px] text-gray-500 dark:text-gray-400 font-bold uppercase mt-0.5 flex items-center gap-1">
                              By @{item.user} {(allUsers[item.user] as UserProfile)?.permissions?.isVerified && <VerifiedBadge size={10} />}
                            </div>
                          )}
                        </div>
                        <ArrowRight size={14} className="text-gray-400 absolute right-12 group-hover:translate-x-1 transition-transform" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onDismissMissed(item.id); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-500" type="button"><X size={16} /></button>
                    </motion.div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {combinedMissed.length > 3 && (
                <button onClick={() => setShowAllMissed(!showAllMissed)} className="w-full py-3 bg-gray-50 dark:bg-[#1f2937] rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-[10px] font-black uppercase text-gray-400 flex items-center justify-center gap-2" type="button">
                  {showAllMissed ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {showAllMissed ? 'Show Less' : `View All (${combinedMissed.length})`}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};