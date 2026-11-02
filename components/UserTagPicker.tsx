import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, Check, X, Search, Users, Heart } from 'lucide-react';
import { UserProfile } from '../types';
import { VerifiedBadge } from './VerifiedBadge';

export const UserTagPicker: React.FC<{ 
  allUsers: Record<string, UserProfile>; 
  currentUser: UserProfile; 
  selectedUsernames: string[]; 
  onToggleUser: (username: string) => void; 
  variant?: 'icon' | 'full' | 'hidden';
  buddyIds?: string[];
  isOpen?: boolean;
  onClose?: () => void;
  onSend?: () => void;
  triggerIcon?: React.ReactNode;
  triggerClassName?: string;
}> = ({ allUsers, currentUser, selectedUsernames, onToggleUser, variant = 'full', buddyIds = [], isOpen: controlledIsOpen, onClose, onSend, triggerIcon, triggerClassName }) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const setIsOpen = (val: boolean) => {
      if (onClose && !val) onClose();
      setInternalIsOpen(val);
    };
    
    const safeBuddyIds = Array.isArray(buddyIds) ? buddyIds : [];
    const safeSelectedUsernames = Array.isArray(selectedUsernames) ? selectedUsernames : [];
  
    const userList = useMemo(() => {
      if (!allUsers) return [];
      return (Object.values(allUsers) as UserProfile[])
        .filter(u => u && u.id !== currentUser.id && (u.username || '').toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
          // Sort buddies to the top for convenience
          const aIsBuddy = safeBuddyIds.includes(a.id);
          const bIsBuddy = safeBuddyIds.includes(b.id);
          if (aIsBuddy && !bIsBuddy) return -1;
          if (!aIsBuddy && bIsBuddy) return 1;
          return 0;
        });
    }, [allUsers, currentUser.id, search, safeBuddyIds]);
    
    const trigger = variant === 'hidden' ? null : variant === 'icon' ? (
      <div 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
        className={triggerClassName || `w-full h-full flex items-center justify-center rounded-xl transition-all cursor-pointer hover:text-primary active:scale-95 shrink-0 ${safeSelectedUsernames.length > 0 ? 'bg-primary text-white hover:text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
      >
        {triggerIcon || <UserPlus size={20} />}
      </div>
    ) : (
    <button 
      onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${safeSelectedUsernames.length > 0 ? 'bg-primary/10 border-primary text-primary' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'}`} 
      type="button"
    >
      <UserPlus size={12} />
      {safeSelectedUsernames.length > 0 ? `Tagged: ${safeSelectedUsernames.length}` : 'Tag Contributors'}
    </button>
  );

  const modalContent = isOpen ? (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-hidden" onClick={() => setIsOpen(false)}>
      <div 
        className="w-full max-w-sm bg-white dark:bg-[#111827] rounded-[2.5rem] shadow-2xl border-2 border-primary/20 dark:border-gray-800 overflow-hidden flex flex-col animate-pop-in max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl text-primary"><Users size={20} /></div>
            <div>
              <h3 className="font-black text-sm text-gray-800 dark:text-gray-100 uppercase tracking-widest">Tag Menders</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase">{safeSelectedUsernames.length} Selected</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 bg-white dark:bg-[#111827]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              autoFocus 
              className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-gray-100 transition-all shadow-inner font-bold" 
              placeholder="Search menders..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y dark:divide-gray-800 hide-scrollbar bg-white dark:bg-[#111827]">
          {userList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center opacity-50">
              <Search size={32} className="text-gray-300 mb-2" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No menders found.</p>
            </div>
          ) : (
            userList.map(u => {
              if (!u || !u.id || !u.username) return null;
              const isBuddy = safeBuddyIds.includes(u.id);
              const isSelected = safeSelectedUsernames.includes(u.username);
              return (
                <button 
                  key={u.id} 
                  onClick={() => {
                    try {
                      onToggleUser(u.username);
                    } catch (err) {
                      console.error("Error toggling user:", err);
                    }
                  }} 
                  className={`w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-all group ${isSelected ? 'bg-primary/5' : ''} ${isBuddy ? 'bg-secondary/5 dark:bg-secondary/5' : ''}`} 
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden border-2 border-transparent group-hover:border-primary/30 transition-all shrink-0">
                      {u.profilePicture ? (
                        <img src={u.profilePicture} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-black text-gray-400">
                          {u.username.slice(0,2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-black text-gray-800 dark:text-gray-100 flex items-center gap-1">
                        <span className="flex items-center gap-0.5"><span className="text-gray-400">@</span>{u.username}</span> 
                        {u.permissions?.isVerified && <VerifiedBadge size={14} />}
                        {isBuddy && <span className="flex items-center gap-0.5 bg-green-100/20 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ml-1"><Heart size={8} fill="currentColor" /> Mending Buddy</span>}
                      </div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{u.totalXP === -1 ? '∞' : (u.totalXP || 0).toLocaleString()} XP</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary text-white scale-110 shadow-md' : 'border-gray-200 dark:border-gray-700 text-transparent'}`}>
                    <Check size={14} strokeWidth={4} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-800">
          {onSend ? (
            <button 
              onClick={() => { onSend(); setIsOpen(false); }}
              disabled={safeSelectedUsernames.length === 0}
              className="w-full bg-primary text-white font-black py-4 rounded-2xl uppercase text-xs tracking-[0.2em] shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
            >
              Send Invite
            </button>
          ) : (
            <button 
              onClick={() => setIsOpen(false)}
              className="w-full bg-primary text-white font-black py-4 rounded-2xl text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/20 active:scale-95 transition-all hover:bg-primary/90"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {trigger}
      {createPortal(modalContent, document.body)}
    </>
  );
};