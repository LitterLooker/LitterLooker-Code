
import React, { useMemo } from 'react';
import { ArrowLeft, Medal, Star, Sparkles, Trophy, Gift } from 'lucide-react';
import { UserProfile } from '../types';
import { ACHIEVEMENTS_DATA } from '../constants';
import { TitleDisplay } from './TitleDisplay';

export const AchievementsPage: React.FC<{ 
  user: UserProfile; 
  allUsers: Record<string, UserProfile>; 
  onBack: () => void;
  targetUser?: UserProfile; 
}> = ({ user, allUsers, onBack, targetUser }) => {
  const displayUser = targetUser || user;
  const isSelf = displayUser.id === user.id;

  const rarityWeights: Record<string, number> = {
    'Common': 1,
    'Rare': 2,
    'Legendary': 3
  };

  const visibleAchievements = useMemo(() => {
    return [...ACHIEVEMENTS_DATA]
      .filter(a => !a.hidden)
      .sort((a, b) => (rarityWeights[a.rarity] || 0) - (rarityWeights[b.rarity] || 0));
  }, []);

  const secretAchievements = useMemo(() => {
    return ACHIEVEMENTS_DATA
      .filter(a => a.hidden && displayUser.completedAchievements?.includes(a.id))
      .sort((a, b) => (rarityWeights[a.rarity] || 0) - (rarityWeights[b.rarity] || 0));
  }, [displayUser.completedAchievements]);

  const completedVisibleCount = useMemo(() => {
    return visibleAchievements.filter(a => displayUser.completedAchievements?.includes(a.id)).length;
  }, [visibleAchievements, displayUser.completedAchievements]);

  const totalVisibleCount = visibleAchievements.length;
  const progressPercent = Math.round((completedVisibleCount / totalVisibleCount) * 100);

  return (
    <div className="flex flex-col h-full bg-transparent animate-fade-in">
      <div className="p-4 bg-primary dark:bg-[#023020] text-white shadow-sm flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition" type="button">
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-bold text-lg">{isSelf ? 'My Achievements' : `@${displayUser.username}'s Achievements`}</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] shadow-xl border dark:border-gray-700 animate-slide-up">
           <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                 <div className="bg-primary/10 p-2 rounded-2xl"><Trophy className="text-primary" size={24} /></div>
                 <div>
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">Overall Progress</p>
                    <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">{completedVisibleCount} / {totalVisibleCount}</h3>
                 </div>
              </div>
              <div className="text-right">
                 <span className="text-2xl font-black text-primary">{progressPercent}%</span>
              </div>
           </div>
           <div className="w-full bg-gray-100 dark:bg-gray-900 h-3 rounded-full overflow-hidden">
              <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
           </div>
        </div>

        <div className="space-y-4">
          {visibleAchievements.map(achievement => {
            const isCompleted = displayUser.completedAchievements?.includes(achievement.id);
            const progress = achievement.getProgress(displayUser, allUsers);
            const target = achievement.target;
            const rarityColor = achievement.rarity === 'Legendary' ? 'border-yellow-400' : achievement.rarity === 'Rare' ? 'border-blue-400' : 'border-gray-300';
            return (
              <div key={achievement.id} className={`p-5 rounded-[2rem] border-2 shadow-lg overflow-hidden ${rarityColor} ${isCompleted ? 'bg-green-50 dark:bg-green-900/20' : 'bg-white dark:bg-gray-800'}`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl shrink-0 ${isCompleted ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>{isCompleted ? <Medal size={24} /> : <Star size={24} />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1"><h3 className={`font-black uppercase tracking-tight text-sm ${isCompleted ? 'text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-white'}`}>{achievement.title}</h3>{isCompleted && <span className="text-[8px] bg-green-500 text-white px-2 py-0.5 rounded-full font-black uppercase">Completed</span>}</div>
                    <p className={`text-xs font-bold leading-relaxed mb-3 ${isCompleted ? 'text-green-600 dark:text-green-500' : 'text-gray-500'}`}>{achievement.description}</p>
                    <div className="flex items-center justify-between gap-3 mb-4"><div className="flex-1 bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${isCompleted ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${isCompleted ? 100 : Math.min(100, (progress / target) * 100)}%` }} /></div><span className="text-[10px] font-black text-gray-400 shrink-0">{isCompleted ? target : Math.min(target, progress)} / {target}</span></div>
                    
                    <div className="space-y-1.5 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center text-[10px] font-black uppercase"><span className="w-16 text-gray-400">XP:</span><span className="text-primary flex items-center gap-1">+{achievement.reward}</span></div>
                      {achievement.givesTitle && (<div className="flex items-center text-[10px] font-black uppercase"><span className="w-16 text-gray-400">Title:</span><div className="flex items-center gap-1 flex-1 min-w-0"><TitleDisplay title={achievement.title} size="sm" /></div></div>)}
                      {achievement.givesAsset && (
                        <div className="flex items-center text-[10px] font-black uppercase">
                          <span className="w-16 text-gray-400">Asset:</span>
                          <span className="text-primary flex items-center gap-1"><Gift size={10} /> {achievement.givesAsset.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {secretAchievements.length > 0 && (
          <div className="space-y-4 pb-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Secret Achievements Uncovered!</p>
            {secretAchievements.map(achievement => {
                const rarityColor = achievement.rarity === 'Legendary' ? 'border-yellow-400' : achievement.rarity === 'Rare' ? 'border-blue-400' : 'border-gray-300';
                return (
                  <div key={achievement.id} className={`p-5 rounded-[2rem] border-2 shadow-lg overflow-hidden ${rarityColor} bg-purple-100 dark:bg-purple-900/40`}>
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-2xl bg-purple-500 text-white shrink-0"><Sparkles size={24} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1"><h3 className="font-black uppercase tracking-tight text-sm text-purple-700 dark:text-purple-400">{achievement.title}</h3><span className="text-[8px] bg-purple-500 text-white px-2 py-0.5 rounded-full font-black uppercase">Secret</span></div>
                        <p className="text-xs font-bold leading-relaxed mb-2 text-purple-600 dark:text-purple-500">{achievement.description}</p>
                        <div className="space-y-1.5 pt-2 border-t border-purple-200 dark:border-purple-800/50">
                          <div className="flex items-center text-[10px] font-black uppercase"><span className="w-16 text-purple-400">XP:</span><span className="text-purple-600 dark:text-purple-300 flex items-center gap-1">+{achievement.reward}</span></div>
                          {achievement.givesTitle && (
                            <div className="flex items-center text-[10px] font-black uppercase"><span className="w-16 text-purple-400">Title:</span><div className="flex items-center gap-1 flex-1 min-w-0"><TitleDisplay title={achievement.title} size="sm" /></div></div>
                          )}
                          {achievement.givesAsset && (
                            <div className="flex items-center text-[10px] font-black uppercase">
                              <span className="w-16 text-purple-400">Asset:</span>
                              <span className="text-purple-600 flex items-center gap-1"><Gift size={10} /> {achievement.givesAsset.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
