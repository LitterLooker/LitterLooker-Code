import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, Info, CalendarDays, User, Star, X, Sparkles } from 'lucide-react';
import { UserProfile, MapPin, CommunityPost } from '../types';
import { VerifiedBadge } from './VerifiedBadge';
import { TitleDisplay } from './TitleDisplay';
import { ICONS, INFINITY_XP, INFINITY_SYMBOL } from '../constants';
import { Username } from './Username';
import { calculateDistance } from '../utils';

export const LeaderboardPage: React.FC<{ 
  user: UserProfile; 
  onViewProfile: (id: string) => void; 
  allUsers: Record<string, UserProfile>; 
  onClaim: () => void; 
  features: Record<string, boolean>;
  userLocation?: { lat: number; lng: number } | null;
  pins?: MapPin[];
  posts?: CommunityPost[];
}> = ({ user, onViewProfile, allUsers, onClaim, features, userLocation, pins, posts }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [selectedShard, setSelectedShard] = useState<string>(user.leaderboardId || 'LB_0');
  
  useEffect(() => {
    if (user.leaderboardId) {
      setSelectedShard(user.leaderboardId);
    }
  }, [user.leaderboardId]);

  // Show reward modal if user has a pending reward
  useEffect(() => {
    if (user.pendingLeaderboardReward) {
      setShowRewardModal(true);
    }
  }, [user.pendingLeaderboardReward]);

  const availableShards = useMemo(() => {
    const shards = new Set<string>();
    (Object.values(allUsers) as UserProfile[]).forEach(u => {
      if (u.leaderboardId && u.totalXP !== INFINITY_XP) shards.add(u.leaderboardId);
    });
    if (shards.size === 0) shards.add('LB_0');
    return Array.from(shards).sort((a, b) => {
      // Sort numerically if possible (LB_0, LB_1, etc.)
      const numA = parseInt(a.replace('LB_', '')) || 0;
      const numB = parseInt(b.replace('LB_', '')) || 0;
      return numA - numB;
    });
  }, [allUsers]);

  // Filter leaderboard by active shard, strictly capped at 20 users per shard
  const leaders = useMemo(() => {
    const users = Object.values(allUsers) as UserProfile[];
    if (users.length === 0) return [];
    
    const targetLB = user.totalXP === INFINITY_XP ? (selectedShard || 'LB_0') : (user.leaderboardId || 'LB_0');
    const shardUsers = users.filter(u => u.totalXP !== INFINITY_XP && u.leaderboardId === targetLB);
    
    return shardUsers
      .sort((a, b) => (b.monthlyXP || 0) - (a.monthlyXP || 0))
      .slice(0, 20); // Cap at 20 users per shard
  }, [allUsers, selectedShard, user.leaderboardId, user.totalXP]);
  
  const isLoading = Object.keys(allUsers).length === 0;

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date(); 
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1); 
      const diff = nextMonth.getTime() - now.getTime();
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24)); 
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24); 
      const minutes = Math.floor((diff / 1000 / 60) % 60); 
      const seconds = Math.floor((diff / 1000) % 60);
      
      setIsUrgent(days <= 3);
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    };
    
    // Initial calculation
    setTimeLeft(calculateTimeLeft());
    
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000); 
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowInfo(false);
      }
    };
    if (showInfo) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showInfo]);
  
  const currentMonthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date());

  const getPostBorderClass = (borderId?: string) => {
    if (borderId === 'pb_vines_simple') return 'post-border-vines';
    if (borderId === 'pb_flowers') return 'post-border-flowers';
    if (borderId === 'pb_emerald_mist') return 'post-border-emerald-mist';
    return '';
  };

  if (!user.leaderboardId) {
    return (
      <div className="p-4 space-y-4 pb-6 relative bg-transparent min-h-full flex flex-col items-center justify-center">
        <p className="text-center text-gray-500 font-bold mb-4">Compete in the leaderboard next month!</p>
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center gap-5">
            <div className="p-5 rounded-full bg-primary/10 text-primary mb-2 shadow-inner">
              <Info size={40} />
            </div>
            <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Leaderboard Rules</h3>
            <div className="space-y-4 text-sm font-bold text-gray-500 dark:text-gray-400 leading-relaxed text-left bg-gray-50 dark:bg-gray-900/50 p-6 rounded-3xl border dark:border-gray-800">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <p>Resets every <span className="text-primary font-black">1st of the month</span>.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <p>Earn <span className="text-primary font-black">Monthly XP</span> by reporting and clearing litter.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <p>Finish in the top ranks to earn <span className="text-secondary font-black drop-shadow-sm">Scrap Rewards</span>!</p>
              </div>
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <p>Exclusive <span className="text-primary font-black">Titles</span> are awarded to consistent legends.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-6 relative bg-transparent min-h-full">
      <div className="pt-10 pb-6 text-center animate-fade-in">
        <h1 className="text-5xl font-black text-primary uppercase tracking-tighter drop-shadow-sm">LEADERBOARD</h1>
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mt-3 px-6 leading-relaxed">
          Compete with other menders to earn rewards!
        </p>
        
        {user.totalXP === INFINITY_XP && (
          <div className="mt-4 flex justify-center animate-fade-in">
            <div className="relative inline-block">
              <select
                value={selectedShard}
                onChange={(e) => setSelectedShard(e.target.value)}
                className="appearance-none bg-white dark:bg-gray-800 border-2 border-primary/20 text-primary font-black text-[10px] uppercase tracking-widest py-2 pl-4 pr-8 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {availableShards.map(shard => (
                  <option key={shard} value={shard}>
                    Shard: {shard} {shard === user.leaderboardId ? '(Your Shard)' : ''}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-primary">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {showRewardModal && user.pendingLeaderboardReward && typeof window !== 'undefined' && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in">
          <div className="bg-white dark:bg-[#1f2937] rounded-[2.5rem] p-6 shadow-2xl w-full max-w-sm border-4 border-primary animate-pop-in relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
              <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 animate-pulse" />
              <Sparkles className="absolute top-6 left-6 text-green-400 animate-bounce" size={30} />
              <Sparkles className="absolute bottom-6 right-6 text-primary animate-pulse" size={40} />
              <Star className="absolute top-20 right-6 text-secondary animate-spin-slow" size={20} />
              <Trophy className="absolute -bottom-10 -left-10 text-primary/5 rotate-12" size={150} />
            </div>

            <div className="flex flex-col items-center text-center gap-5 relative z-10">
              <div className="relative">
                <div className="p-6 rounded-full bg-gradient-to-b from-primary/20 to-primary/5 text-primary mb-1 shadow-inner ring-[8px] ring-primary/5">
                  <Trophy size={60} className="text-primary drop-shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
                </div>
                <div className="absolute -top-1 -right-1 bg-secondary text-green-900 w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shadow-2xl border-4 border-white dark:border-gray-800 rotate-12">
                  #{user.pendingLeaderboardReward.rank}
                </div>
              </div>

              <div className="space-y-1">
                <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tighter leading-none">Season Hero!</h2>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-80">
                  {user.pendingLeaderboardReward.monthName} Results
                </p>
              </div>

              <div className="w-full space-y-3">
                <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-[2rem] border-2 border-primary/20 shadow-inner space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Final Standing</p>
                      <p className="text-lg font-black text-gray-800 dark:text-white">Rank #{user.pendingLeaderboardReward.rank}</p>
                    </div>
                    <div className="bg-primary/10 p-2 rounded-xl text-primary">
                      <Trophy size={18} />
                    </div>
                  </div>
                  
                  <div className="h-px bg-gray-200 dark:bg-gray-800" />
                  
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total Reward</p>
                      <p className="text-2xl font-black text-secondary drop-shadow-sm">+{user.pendingLeaderboardReward.reward.toLocaleString()}</p>
                    </div>
                    <div className="bg-secondary/10 p-2 rounded-xl text-secondary">
                      <Sparkles size={18} />
                    </div>
                  </div>
                </div>
                
                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest px-4">
                  Rewards include both XP and spendable Scrap!
                </p>
              </div>

              <button 
                onClick={() => {
                  onClaim();
                  setShowRewardModal(false);
                }}
                className="w-full bg-primary text-white font-black py-4 rounded-[1.5rem] uppercase text-xs tracking-[0.2em] shadow-xl shadow-primary/40 active:scale-95 transition-all flex items-center justify-center gap-3 group"
              >
                <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
                Claim My Rewards
                <Sparkles size={18} className="group-hover:-rotate-12 transition-transform" />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="p-4 flex justify-between items-end relative">
        <div>
          <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1.5">{currentMonthName.toUpperCase()} SEASON ENDS IN:</p>
          <p className={`text-2xl font-black font-mono tracking-tight transition-colors ${timeLeft === '' ? 'text-gray-400 animate-pulse' : isUrgent ? 'text-red-500' : 'text-gray-800 dark:text-white'}`}>
            {timeLeft || 'Loading...'}
          </p>
        </div>
        <button 
          onClick={() => setShowInfo(true)}
          className="bg-gray-100 dark:bg-gray-800 p-3 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 active:scale-90 transition-all hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <Info size={24} />
        </button>
      </div>

      <div className="space-y-4 pt-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Syncing Leaderboard...</p>
          </div>
        ) : leaders.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-800">
            <p className="text-gray-400 font-bold italic">No menders in this shard yet.</p>
          </div>
        ) : leaders.map((u, index) => {
          const rankNum = index + 1;
          const isTopThree = rankNum <= 3;
          let rankColorClass = 'text-green-800 dark:text-green-500 border-2 border-green-800 dark:border-green-500 bg-transparent';
          let borderClass = 'border-gray-100 dark:border-gray-800';
          let bgClass = 'bg-gray-50 dark:bg-gray-800/50';
          let starIcon = null;
          let profileRingClass = 'border-green-800 dark:border-green-500';

          if (rankNum === 1) {
            rankColorClass = 'text-yellow-500 border-2 border-yellow-500 bg-transparent shadow-md';
            borderClass = 'border-yellow-400 dark:border-yellow-500/50';
            bgClass = 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/20';
            starIcon = <Sparkles size={10} className="text-yellow-500 animate-pulse absolute -top-1 -right-1" />;
            profileRingClass = 'border-yellow-500';
          } else if (rankNum === 2) {
            rankColorClass = 'text-slate-400 border-2 border-slate-400 bg-transparent shadow-md';
            borderClass = 'border-slate-300 dark:border-slate-400/50';
            bgClass = 'bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/40 dark:to-slate-700/30';
            profileRingClass = 'border-slate-400';
          } else if (rankNum === 3) {
            rankColorClass = 'text-amber-600 border-2 border-amber-600 bg-transparent shadow-md';
            borderClass = 'border-amber-600 dark:border-amber-700/50';
            bgClass = 'bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20';
            profileRingClass = 'border-amber-600';
          }

          return (
            <div 
              key={u.id} 
              onClick={() => onViewProfile(u.id)} 
              className={`p-3 rounded-[2rem] flex items-center gap-2 cursor-pointer hover:scale-[1.02] transition-all border-2 shadow-sm ${bgClass} ${borderClass} ${u.id === user.id ? 'ring-4 ring-primary/20' : ''} ${getPostBorderClass(u.selectedPostBorder)}`}
            >
              <div className="relative shrink-0 w-8 h-8 flex items-center justify-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black ${rankColorClass}`}>
                  {rankNum}
                </div>
                {starIcon}
              </div>
              <div className="shrink-0">
                <div className={`w-10 h-10 rounded-full overflow-hidden border-2 shadow-sm bg-gray-100 dark:bg-gray-900 ${profileRingClass}`}>
                  {u.profilePicture ? (<img src={u.profilePicture} alt={u.username} className="w-full h-full object-cover" />) : (<div className="w-full h-full flex items-center justify-center text-gray-300"><User size={20} /></div>)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-[10px] sm:text-sm text-gray-900 dark:text-gray-100 flex items-center gap-0.5">
                  <span className="text-gray-400 font-bold">@</span>
                  <Username user={u} /> {(u.permissions?.isVerified || u.permissions?.isCreator || u.permissions?.isModerator || u.permissions?.isAdmin || u.isAdmin) && <VerifiedBadge size={14} />}
                </div>
                {u.selectedTitle && (<div className="leading-none mt-0.5"><TitleDisplay title={u.selectedTitle} size="xs" /></div>)}
              </div>
              <div className="text-right shrink-0">
                <span className={`font-black text-xl ${isTopThree ? 'text-primary' : 'text-gray-800 dark:text-gray-300'}`}>
                  {u.monthlyXP === INFINITY_XP ? INFINITY_SYMBOL : (u.monthlyXP || 0).toLocaleString()}
                </span>
                <p className="text-[9px] text-gray-400 uppercase font-black tracking-tighter">MONTHLY XP</p>
              </div>
            </div>
          );
        })}
      </div>

      {showInfo && typeof window !== 'undefined' && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[100000] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowInfo(false)}
        >
          <div 
            className="bg-white dark:bg-[#1f2937] rounded-[2.5rem] p-8 shadow-2xl w-full max-w-sm border dark:border-gray-700 animate-pop-in relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowInfo(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors p-1"><X size={24} /></button>
            <div className="flex flex-col items-center text-center gap-5">
              <div className="p-5 rounded-full bg-primary/10 text-primary mb-2 shadow-inner">
                <Info size={40} />
              </div>
              <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Leaderboard Rules</h3>
              <div className="space-y-4 text-sm font-bold text-gray-500 dark:text-gray-400 leading-relaxed text-left bg-gray-50 dark:bg-gray-900/50 p-6 rounded-3xl border dark:border-gray-800">
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <p>Resets every <span className="text-primary font-black">1st of the month</span>.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <p>Earn <span className="text-primary font-black">Monthly XP</span> by reporting and clearing litter.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <p>Finish in the top ranks to earn <span className="text-secondary font-black drop-shadow-sm">Scrap Rewards</span>!</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <p>Exclusive <span className="text-primary font-black">Titles</span> are awarded to consistent legends.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowInfo(false)}
                className="w-full bg-primary text-white font-black py-4 rounded-2xl uppercase text-xs tracking-[0.2em] shadow-lg shadow-primary/20 mt-4 active:scale-95 transition-all"
              >
                Close Info
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};