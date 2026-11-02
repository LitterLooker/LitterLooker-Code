import React from 'react';
import { Ban, Clock } from 'lucide-react';
import { UserProfile } from '../types';

interface BlockedScreenProps {
  user: UserProfile;
  onLogout: () => void;
}

export const BlockedScreen: React.FC<BlockedScreenProps> = ({ user, onLogout }) => {
  const isPermanent = user.banLevel === 4;
  const remainingTime = !isPermanent && user.blockedUntil ? Math.max(0, user.blockedUntil - Date.now()) : 0;
  
  const formatRemaining = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const mins = Math.ceil((ms % 3600000) / 60000);
    if (hours > 24) return `${Math.floor(hours/24)}d ${hours%24}h remaining`;
    return `${hours}h ${mins}m remaining`;
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-[#0a0f18] flex items-center justify-center p-8 animate-fade-in">
      <div className="max-w-sm w-full bg-gray-900 border-2 border-red-600/50 rounded-[3rem] p-10 text-center shadow-2xl space-y-8 animate-pop-in">
        <div className="bg-red-600/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-red-600 border-4 border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.3)]">
          {isPermanent ? <Ban size={48} /> : <Clock size={48} />}
        </div>
        
        <div className="space-y-3">
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">
            {isPermanent ? "ACCESS DENIED" : "SUSPENDED"}
          </h2>
          <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em]">Sanction Level {user.banLevel || 'X'}</p>
        </div>

        <div className="bg-white/5 rounded-3xl p-6 border border-white/10 text-left space-y-4">
          <div>
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Reason for block</p>
            <p className="text-sm font-bold text-gray-200 leading-relaxed italic">"{user.blockReason || 'Violation of community mending guidelines.'}"</p>
          </div>
          
          {!isPermanent && (
            <div>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Access Restored In</p>
              <div className="flex items-center gap-2 text-primary font-black text-sm uppercase">
                <Clock size={14} /> {formatRemaining(remainingTime)}
              </div>
            </div>
          )}
        </div>

        <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed px-2">
          {isPermanent 
            ? "Your account has been permanently terminated due to severe or repeated violations." 
            : "Repeated violations result in escalated block times and eventual permanent ban."}
        </p>

        <button 
          onClick={onLogout}
          className="w-full py-4 rounded-2xl bg-white text-black font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all"
        >
          Logout Mender
        </button>
      </div>
    </div>
  );
};
