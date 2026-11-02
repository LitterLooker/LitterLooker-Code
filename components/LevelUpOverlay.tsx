
import React, { useEffect, useState } from 'react';
import { PartyPopper, Sparkles, Gift, ChevronRight } from 'lucide-react';
import { Confetti } from './Confetti';
import { getRankIconPath } from '../utils';

export const LevelUpOverlay: React.FC<{ rank: any; onClose: () => void }> = ({ rank, onClose }) => {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const isLegend = rank.level === 15;
  const isRoyal = rank.level === 13;
  const isProtector = rank.level === 14;

  let bgClass = "bg-white dark:bg-gray-900 border-primary animate-pop-in";
  let titleClass = "text-primary";
  let rankIcon = (
    <div className="w-24 h-24 mx-auto rounded-full overflow-hidden">
      <img src={getRankIconPath(rank.name)} alt={rank.name} className="w-full h-full object-contain" />
    </div>
  );

  if (isLegend) {
    bgClass = "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 border-green-400 shadow-[0_0_50px_rgba(20,83,45,0.3)] animate-pop-in";
    titleClass = "text-green-800";
    rankIcon = (
      <div className="w-32 h-32 mx-auto rounded-full overflow-hidden">
        <img src={getRankIconPath(rank.name)} alt={rank.name} className="w-full h-full object-contain" />
      </div>
    );
  } else if (isProtector) {
    bgClass = "bg-slate-50 dark:bg-slate-900 border-slate-400 animate-pop-in";
    titleClass = "text-slate-600";
    rankIcon = (
      <div className="w-32 h-32 mx-auto rounded-full overflow-hidden">
        <img src={getRankIconPath(rank.name)} alt={rank.name} className="w-full h-full object-contain" />
      </div>
    );
  } else if (isRoyal) {
    bgClass = "bg-orange-50 dark:bg-orange-900/20 border-orange-400 animate-pop-in";
    titleClass = "text-orange-600";
    rankIcon = (
      <div className="w-32 h-32 mx-auto rounded-full overflow-hidden">
        <img src={getRankIconPath(rank.name)} alt={rank.name} className="w-full h-full object-contain" />
      </div>
    );
  }

  const rewards = rank.rewards || [];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
      <Confetti />
      <div className={`text-center space-y-4 max-w-sm w-full rounded-[3rem] p-8 border-4 shadow-2xl ${bgClass}`}>
        <div className="relative inline-block">
          {rankIcon}
          <Sparkles className={`absolute -top-4 -right-4 ${isLegend ? 'text-green-600' : 'text-primary'}`} size={32} />
        </div>
        <div className="space-y-1">
          <h1 className={`text-3xl font-black uppercase italic tracking-tighter drop-shadow-sm ${titleClass}`}>Level Up!</h1>
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Promotion Earned</p>
        </div>
        <div className="py-4 border-y border-gray-100 dark:border-gray-800 space-y-1">
          <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase">{rank.name}</h2>
          <div className="flex items-center justify-center gap-2">
            <span className={`font-black text-lg ${titleClass}`}>Level {rank.level}</span>
          </div>
        </div>
        {rewards.length > 0 && (
          <div className="space-y-2 pt-2">
             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-center gap-1"><Gift size={10} /> Rewards</p>
             <div className="flex flex-wrap justify-center gap-2">
                {rewards.map((r: any) => (
                  <div key={r.id} className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border border-primary/20 shadow-sm animate-slide-up">
                    {r.name}
                  </div>
                ))}
             </div>
          </div>
        )}

        {showButton && (
          <button 
            onClick={onClose}
            className="w-full mt-6 bg-primary text-white font-black py-4 rounded-2xl uppercase text-xs tracking-[0.2em] shadow-lg shadow-primary/20 animate-pop-in active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            Continue <ChevronRight size={16} />
          </button>
        )}
      </div>
      <style>{`
        @keyframes pop-in {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop-in {
          animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </div>
  );
};
