
import React, { useEffect } from 'react';
import { Sparkles, Zap, Coins } from 'lucide-react';

export const ScrapGainBox: React.FC<{ amount: number; onClose: () => void }> = ({ amount, onClose }) => {
  useEffect(() => { 
    const timer = setTimeout(onClose, 3000); 
    return () => clearTimeout(timer); 
  }, []);
  return (
    <div className="fixed bottom-24 left-4 z-[110] pointer-events-none animate-bounce">
      <div className="bg-primary text-white px-4 py-3 rounded-2xl shadow-2xl flex flex-col gap-1 border-2 border-white/20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Zap className="text-secondary animate-pulse" size={14} />
          <span className="font-black text-[10px] uppercase">+{amount.toLocaleString()} XP</span>
        </div>
        <div className="flex items-center gap-2">
          <Coins className="text-secondary" size={14} />
          <span className="font-black text-[10px] uppercase">+{amount.toLocaleString()} Scrap</span>
        </div>
        <Sparkles className="absolute -top-2 -right-2 text-secondary animate-spin-slow" size={12} />
      </div>
    </div>
  );
};
