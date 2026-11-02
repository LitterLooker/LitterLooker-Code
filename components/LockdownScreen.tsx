import React from 'react';
import { ICONS } from '../constants';
import { useIsDarkMode } from '../utils';

interface LockdownScreenProps {
  lockdownReason?: string;
  onLogout: () => void;
}

export const LockdownScreen: React.FC<LockdownScreenProps> = ({ lockdownReason, onLogout }) => {
  const cleanReason = lockdownReason ? lockdownReason.replace(/^["'“”‘’]|["'“”‘’]$/g, '').trim() : '';
  const isDarkMode = useIsDarkMode();

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#22c55e] dark:bg-[#023020] p-8 text-center">
      <img src={isDarkMode ? "/Graphics/LitterLookerTitleDark.png?v=2" : ICONS.TITLE} alt="LitterLooker" className="w-96 h-48 object-contain mb-8 animate-bounce-slow" />
      <h1 className="text-white font-black text-5xl uppercase tracking-tighter mb-4 drop-shadow-md">Currently unavailable</h1>
      {cleanReason && (
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 mb-6 max-w-xs">
          <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-2">Reason</p>
          <p className="text-white font-bold text-sm leading-relaxed">{cleanReason}</p>
        </div>
      )}
      <p className="text-white/90 font-bold text-xl uppercase tracking-widest mb-12 drop-shadow-sm">please check back later!</p>
      <button 
        onClick={onLogout}
        className="px-8 py-4 bg-white text-[#22c55e] font-black rounded-2xl uppercase text-sm tracking-widest shadow-xl active:scale-95 transition-all hover:bg-gray-50"
      >
        Return to Login
      </button>
    </div>
  );
};
