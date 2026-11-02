import React, { useEffect } from 'react';
import { Check, Gift, Zap, User, Users, MapPin } from 'lucide-react';
import { UserProfile } from '../types';
import { RANK_SYSTEM, AssetReward } from '../constants';
import { getRankInfo, getRankIconPath } from '../utils';

interface LevelItemProps {
  rank: typeof RANK_SYSTEM[number];
  isCurrent: boolean;
  isPast: boolean;
  ITEM_HEIGHT: number;
}

const LevelItem: React.FC<LevelItemProps> = React.memo(({ rank, isCurrent, isPast, ITEM_HEIGHT }) => {
  return (
    <div 
      className="flex items-center relative" 
      style={{ height: `${ITEM_HEIGHT}px` }}
    >
      {/* Level label container - EXACTLY 32px (w-8) width to align the circle center perfectly at 56px */}
      <div className="w-8 shrink-0 flex justify-end pr-3 select-none">
        <span className={`text-[11px] font-black tracking-tight ${isCurrent || isPast ? 'text-primary' : 'text-gray-400 dark:text-gray-600'}`}>
          {rank.level}
        </span>
      </div>

      {/* Icon Container - EXACTLY 48px (w-12) width, center is at 32 + 24 = 56px */}
      <div className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shrink-0 transition-all bg-white dark:bg-[#0f172a] relative z-10 border-2 ${isCurrent ? 'scale-110 ring-4 ring-primary/20 border-primary shadow-lg shadow-primary/25' : 'border-gray-200 dark:border-gray-700'}`}>
        <img 
          src={getRankIconPath(rank.name)} 
          alt={`${rank.name} Icon`} 
          className={`w-full h-full object-contain ${!isPast && !isCurrent ? 'opacity-50 grayscale' : ''}`}
          loading="eager"
        />
      </div>

      {/* Content details - offset slightly to avoid tight fit */}
      <div className="flex-1 min-w-0 pl-4 pr-1 py-1">
        <div className="flex items-center justify-between gap-1.5 mb-0.5">
          <h3 className={`font-black text-sm uppercase tracking-tight ${isCurrent ? 'text-primary' : 'text-gray-800 dark:text-gray-300'}`}>{rank.name}</h3>
          {isCurrent && <span className="text-[8px] bg-primary text-white px-2 py-0.5 rounded-full font-black tracking-widest animate-pulse">CURRENT</span>}
        </div>
        <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold tracking-wide">{rank.threshold.toLocaleString()} XP Required</p>
        
        {rank.rewards && rank.rewards.length > 0 && (
          <div className="mt-1">
            <div className="flex flex-wrap gap-1">
              {rank.rewards.map((reward: AssetReward) => (
                <div 
                  key={reward.id} 
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider border transition-colors ${
                    isPast || isCurrent 
                      ? 'bg-primary/10 border-primary/20 text-primary' 
                      : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400'
                    }`}
                >
                  {reward.type === 'app_skin' && <Zap size={6} />}
                  {reward.type === 'pin_design' && <MapPin size={6} />}
                  {reward.type === 'profile_border' && <User size={6} />}
                  {reward.type === 'post_border' && <Check size={6} />}
                  {reward.type === 'ability' && <Gift size={6} />}
                  {(reward.type === 'username_color' || reward.type === 'username_gradient') && <Users size={6} />}
                  <span>{reward.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

LevelItem.displayName = 'LevelItem';

export const RankPathModal: React.FC<{ user: UserProfile; onClose: () => void }> = ({ user, onClose }) => {
  const userXP = typeof user.totalXP === 'number' ? user.totalXP : 0;
  const currentRank = getRankInfo(userXP);
  
  const ITEM_HEIGHT = 96; 
  const GAP = 24;
  const STEP = ITEM_HEIGHT + GAP;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] bg-gray-50 dark:bg-[#0f172a] flex flex-col animate-fade-in">
      <div className="p-4 bg-primary text-white shadow-sm flex items-center gap-3 shrink-0">
        <button 
          id="rank-path-close-button"
          onClick={onClose} 
          className="p-3 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center shrink-0" 
          type="button"
          aria-label="Close Level Path"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </button>
        <h2 className="font-bold text-lg">{user.username}'s Level Path</h2>
      </div>
      <div className="flex-1 overflow-y-auto relative bg-gray-50 dark:bg-[#0f172a] hide-scrollbar p-6">
        <div className="max-w-2xl mx-auto w-full relative min-h-full">
            {/* Background Line Track - Perfectly centered through standard index 10 icon circles at 56px */}
            <div 
              className="absolute left-[56px] w-1 bg-gray-200 dark:bg-gray-800 z-0 -translate-x-1/2 rounded-full"
              style={{ 
                top: '48px', 
                height: `${(RANK_SYSTEM.length - 1) * STEP}px` 
              }}
            ></div>
            
            {/* Active Progress Segment Lines - Perfectly centered through standard index 10 icon circles at 56px */}
            {RANK_SYSTEM.map((rank, idx) => {
              if (idx === RANK_SYSTEM.length - 1) return null;
              const nextThreshold = RANK_SYSTEM[idx + 1].threshold;
              const currentThreshold = rank.threshold;
              const range = nextThreshold - currentThreshold;
              const progressInSegment = Math.min(range, Math.max(0, (userXP === -1 ? 999999999 : userXP) - currentThreshold));
              const segmentPercent = progressInSegment / (range || 1);
              const topOffset = idx * STEP + 48;
              return (
                <div 
                  key={`line-segment-${idx}`} 
                  className="absolute left-[56px] w-1 z-0 -translate-x-1/2 overflow-hidden bg-transparent" 
                  style={{ top: `${topOffset}px`, height: `${STEP}px` }}
                >
                  <div 
                    className="w-full bg-primary" 
                    style={{ height: `${segmentPercent * 100}%` }} 
                  />
                </div>
              );
            })}
 
            <div className="space-y-6 relative z-10 w-full">
              {RANK_SYSTEM.map((rank) => {
                const isCurrent = currentRank.level === rank.level;
                const isPast = currentRank.level > rank.level;
                
                return (
                  <LevelItem 
                    key={rank.level}
                    rank={rank}
                    isCurrent={isCurrent}
                    isPast={isPast}
                    ITEM_HEIGHT={ITEM_HEIGHT}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
  );
};
