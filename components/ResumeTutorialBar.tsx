import React from 'react';
import { Zap } from 'lucide-react';

export const ResumeTutorialBar: React.FC<{ onResume: () => void }> = ({ onResume }) => (
  <div className="bg-primary text-white p-3 flex items-center justify-between shadow-lg z-50 w-full">
    <div className="flex items-center gap-2">
      <Zap size={16} />
      <span className="text-[10px] font-black uppercase tracking-widest">Tutorial Unfinished</span>
    </div>
    <button onClick={onResume} className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-lg">Resume</button>
  </div>
);
