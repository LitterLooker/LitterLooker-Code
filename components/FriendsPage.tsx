
import React, { useState, useMemo } from 'react';
import { ArrowLeft, UserPlus, UserCheck, UserMinus, Search, Clock, Check, X, User } from 'lucide-react';
import { UserProfile, FriendRequest } from '../types';
import { VerifiedBadge } from './VerifiedBadge';
import { Username } from './Username';

export const FriendsPage: React.FC<{
  user: UserProfile;
  allUsers: Record<string, UserProfile>;
  onBack: () => void;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  onRemove: (friendId: string) => void;
  onViewProfile: (userId: string) => void;
  onSendRequest: (targetId: string) => void;
}> = ({ user, allUsers, onBack, onAccept, onDecline, onRemove, onViewProfile, onSendRequest }) => {
  const [search, setSearch] = useState('');
  
  const userFriends = useMemo(() => {
    return (user.friends || []).map(id => (Object.values(allUsers) as UserProfile[]).find(u => u.id === id)).filter(Boolean) as UserProfile[];
  }, [user.friends, allUsers]);

  const globalSearchResults = useMemo(() => {
    if (!search.trim()) return [];
    return (Object.values(allUsers) as UserProfile[])
      .filter(u => !u.isAdmin && u.id !== user.id && u.username.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 10);
  }, [allUsers, search, user.id]);

  const requests = user.friendRequests || [];

  const renderUserAction = (targetUser: UserProfile) => {
    const isFriend = (user.friends || []).some(fId => fId === targetUser.id || fId === targetUser.uid);
    const hasSentRequest = (targetUser.friendRequests || []).some(r => r.fromUserId === user.id || r.fromUserId === user.uid);
    const hasReceivedRequest = (user.friendRequests || []).some(r => r.fromUserId === targetUser.id || r.fromUserId === targetUser.uid);

    if (isFriend) {
      return (
        <div className="flex items-center gap-1 text-green-500 font-black text-[10px] uppercase">
          <UserCheck size={14} /> Mending Buddy
        </div>
      );
    }

    if (hasSentRequest) {
      return (
        <div className="flex items-center gap-1 text-gray-400 font-black text-[10px] uppercase">
          <Clock size={14} /> Pending
        </div>
      );
    }

    if (hasReceivedRequest) {
      return (
        <button 
          onClick={() => onAccept(targetUser.id)}
          className="bg-primary text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-sm active:scale-95 transition-all"
        >
          Accept
        </button>
      );
    }

    if (targetUser.totalXP === -1) return null;
    if (targetUser.allowFriendRequests === false) return null;

    return (
      <button 
        onClick={() => onSendRequest(targetUser.id)}
        className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-[10px] font-black uppercase hover:bg-primary hover:text-white transition-all active:scale-95"
      >
        Add Mending Buddy
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 animate-fade-in">
      <div className="p-4 bg-primary text-white shadow-sm flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition" type="button">
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-bold text-lg">Buddies</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Friend Requests Section */}
        {requests.length > 0 && !search && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] px-2 flex items-center gap-2">
              <Clock size={12} /> Pending Requests ({requests.length})
            </h3>
            <div className="space-y-3">
              {requests.map(req => {
                const sender = (Object.values(allUsers) as UserProfile[]).find(u => u.id === req.fromUserId);
                return (
                  <div key={req.fromUserId} className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-md border dark:border-gray-700 flex items-center justify-between animate-slide-up">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile(req.fromUserId)}>
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border dark:border-gray-700">
                        {sender?.profilePicture ? <img src={sender.profilePicture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><User size={20} /></div>}
                      </div>
                      <div>
                        <div className="font-black text-sm text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                          <span className="flex items-center gap-0.5">
                            <span>@</span>
                            <Username user={sender || { username: req.fromUsername, id: req.fromUserId, totalXP: 0, availableXP: 0, joinedAt: 0 }} />
                          </span>
                          {/* Fix: Access 'isVerified' through the nested 'permissions' object. */}
                          {sender?.permissions?.isVerified && <VerifiedBadge size={14} />}
                        </div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">Wants to be mending buddies</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onAccept(req.fromUserId)} className="bg-primary text-white p-2 rounded-xl shadow-md hover:scale-105 transition-all"><Check size={18} /></button>
                      <button onClick={() => onDecline(req.fromUserId)} className="bg-gray-100 dark:bg-gray-700 text-gray-400 p-2 rounded-xl shadow-sm hover:scale-105 transition-all"><X size={18} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Global Search Section */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] px-2 flex items-center gap-2">
            <Search size={12} /> Find Buddies
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary outline-none shadow-sm transition-all"
              placeholder="Search by username..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {search && (
            <div className="space-y-3 animate-fade-in">
              <p className="text-[10px] font-black text-gray-400 uppercase px-2">Search Results</p>
              {globalSearchResults.length === 0 ? (
                <div className="text-center py-6 bg-white dark:bg-gray-800 rounded-3xl border border-dashed dark:border-gray-700">
                  <p className="text-xs font-bold text-gray-400 uppercase">No users found</p>
                </div>
              ) : (
                globalSearchResults.map(sUser => (
                  <div key={sUser.id} className="bg-white dark:bg-gray-800 p-4 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between group transition-all hover:shadow-md">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile(sUser.id)}>
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-50 dark:bg-gray-900 border dark:border-gray-700">
                        {sUser.profilePicture ? <img src={sUser.profilePicture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><User size={20} /></div>}
                      </div>
                      <div>
                        <div className="font-black text-sm text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                          <span className="flex items-center gap-0.5">
                            <span>@</span>
                            <Username user={sUser} />
                          </span>
                          {/* Fix: Access 'isVerified' through the nested 'permissions' object. */}
                          {sUser.permissions?.isVerified && <VerifiedBadge size={14} />}
                        </div>
                        <p className="text-[9px] font-bold text-primary uppercase">{sUser.totalXP.toLocaleString()} XP</p>
                      </div>
                    </div>
                    {renderUserAction(sUser)}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* My Friends Section (Only when not searching) */}
        {!search && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] px-2 flex items-center gap-2">
              <UserCheck size={12} /> Your Friends ({userFriends.length})
            </h3>

            <div className="space-y-3 pb-20">
              {userFriends.length === 0 ? (
                <div className="text-center py-10 opacity-50">
                  <UserMinus className="mx-auto mb-2 text-gray-300" size={40} />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    No mending buddies yet. Go make some!
                  </p>
                </div>
              ) : (
                userFriends.map(friend => (
                  <div key={friend.id} className="bg-white dark:bg-gray-800 p-4 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between group transition-all hover:shadow-md">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile(friend.id)}>
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                        {friend.profilePicture ? <img src={friend.profilePicture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><User size={24} /></div>}
                      </div>
                      <div>
                        <div className="font-black text-sm text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                          <span className="flex items-center gap-0.5">
                            <span>@</span>
                            <Username user={friend} />
                          </span>
                          {/* Fix: Access 'isVerified' through the nested 'permissions' object. */}
                          {friend.permissions?.isVerified && <VerifiedBadge size={14} />}
                        </div>
                        <p className="text-[10px] font-bold text-primary uppercase">{friend.totalXP.toLocaleString()} XP</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => onRemove(friend.id)}
                      className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                      title="Remove Mending Buddy"
                    >
                      <UserMinus size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
