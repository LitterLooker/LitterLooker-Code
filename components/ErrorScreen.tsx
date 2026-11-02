import React from 'react';
import { ICONS } from '../constants';
import { useIsDarkMode } from '../utils';

export const ErrorScreen: React.FC<{ error: string, onReset?: () => void }> = ({ error, onReset }) => {
  const isDarkMode = useIsDarkMode();

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-primary dark:bg-[#023020] relative overflow-hidden z-[9999]">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white rounded-full blur-[100px] animate-pulse delay-700" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-8 animate-fade-in text-center p-8">
        <div className="animate-bounce-slow opacity-100">
          <img src={isDarkMode ? "/Graphics/LitterLookerTitleDark.png?v=2" : ICONS.TITLE} alt="LitterLooker" className="w-64 h-32 object-contain" />
        </div>
        
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-white uppercase tracking-[0.2em]">{error.includes('Synchronization') ? 'Synchronization Error' : 'Application Error'}</h2>
          <p className="text-white/70 font-bold uppercase text-[11px] tracking-[0.15em] leading-relaxed max-w-xs mx-auto">
            {error === "Generic" ? "Unknown error" : error}
          </p>
        </div>
        
        <button 
          onClick={() => { if (onReset) onReset(); else window.location.reload(); }} 
          className="px-10 py-4 bg-white text-primary font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all"
        >
          Reload Session
        </button>
      </div>
    </div>
  );
};
