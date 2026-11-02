import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trophy, Sparkles, User, Globe } from 'lucide-react';
import { UserProfile } from '../types';
import { db } from '../services/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { convertWeight, convertArea, getWeightUnit, getAreaUnit } from '../utils';
import { Username } from './Username';

interface WorldRankingsPageProps {
  user: UserProfile;
  onBack: () => void;
  onViewProfile: (userId: string) => void;
  features: Record<string, string>;
}

type TabType = 'weight' | 'area' | 'pieces';

export const WorldRankingsPage: React.FC<WorldRankingsPageProps> = ({ user, onBack, onViewProfile, features }) => {
  const [activeTab, setActiveTab] = useState<TabType>('weight');
  const [leaderboards, setLeaderboards] = useState<{
    weight: any[];
    area: any[];
    pieces: any[];
  }>({ weight: [], area: [], pieces: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboards = async () => {
      setIsLoading(true);
      try {
        const usersRef = collection(db, 'users');
        
        const weightQuery = query(usersRef, orderBy('globalRank_weight', 'asc'), limit(100));
        const areaQuery = query(usersRef, orderBy('globalRank_area', 'asc'), limit(100));
        const piecesQuery = query(usersRef, orderBy('globalRank_pieces', 'asc'), limit(100));

        const [weightSnap, areaSnap, piecesSnap] = await Promise.all([
          getDocs(weightQuery),
          getDocs(areaQuery),
          getDocs(piecesQuery)
        ]);

        const weightData = weightSnap.docs.map(doc => {
          const d = doc.data();
          return { 
            id: doc.id, 
            username: d.username, 
            profilePicture: d.profilePicture, 
            usernameColor: d.usernameColor,
            usernameGradient: d.usernameGradient,
            usernameShine: d.usernameShine,
            stat: d.litterStats?.weightKg || 0, 
            position: d.globalRank_weight 
          };
        }).filter(u => u.position);

        const areaData = areaSnap.docs.map(doc => {
          const d = doc.data();
          return { 
            id: doc.id, 
            username: d.username, 
            profilePicture: d.profilePicture, 
            usernameColor: d.usernameColor,
            usernameGradient: d.usernameGradient,
            usernameShine: d.usernameShine,
            stat: d.litterStats?.areaSqM || 0, 
            position: d.globalRank_area 
          };
        }).filter(u => u.position);

        const piecesData = piecesSnap.docs.map(doc => {
          const d = doc.data();
          return { 
            id: doc.id, 
            username: d.username, 
            profilePicture: d.profilePicture, 
            usernameColor: d.usernameColor,
            usernameGradient: d.usernameGradient,
            usernameShine: d.usernameShine,
            stat: d.litterStats?.piecesCount || 0, 
            position: d.globalRank_pieces 
          };
        }).filter(u => u.position);

        setLeaderboards({
          weight: weightData,
          area: areaData,
          pieces: piecesData
        });
      } catch (error) {
        console.error("Failed to fetch global leaderboards", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLeaderboards();
  }, []);

  const currentLeaderboard = leaderboards[activeTab];
  
  const userRankData = {
    id: user.id,
    username: user.username,
    profilePicture: user.profilePicture,
    usernameColor: user.usernameColor,
    usernameGradient: user.usernameGradient,
    usernameShine: user.usernameShine,
    stat: activeTab === 'weight' ? (user.litterStats?.weightKg || 0) : 
          activeTab === 'area' ? (user.litterStats?.areaSqM || 0) : 
          (user.litterStats?.piecesCount || 0),
    position: activeTab === 'weight' ? user.globalRank_weight : 
              activeTab === 'area' ? user.globalRank_area : 
              user.globalRank_pieces
  };

  const getStatDisplay = (stat: number, tab: TabType) => {
    if (tab === 'weight') return `${convertWeight(stat, user.measurementSystem).toFixed(1)} ${getWeightUnit(user.measurementSystem)}`;
    if (tab === 'area') return `${convertArea(stat, user.measurementSystem).toFixed(1)} ${getAreaUnit(user.measurementSystem)}`;
    return `${stat} pieces`;
  };

  const renderUserBox = (u: any, rankNum: number, isCurrentUser: boolean = false) => {
    let rankColorClass = 'text-green-800 dark:text-green-500 border-2 border-green-800 dark:border-green-500 bg-transparent';
    let borderClass = 'border-gray-100 dark:border-gray-800';
    let bgClass = 'bg-gray-50 dark:bg-gray-800/50';
    let starIcon = null;
    let profileRingClass = 'border-green-800 dark:border-green-500';

    if (rankNum === 1) {
      rankColorClass = 'text-yellow-500 border-2 border-yellow-500 bg-transparent shadow-md';
      borderClass = 'border-yellow-400 dark:border-yellow-500/50';
      bgClass = 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/20';
      starIcon = <Sparkles size={10} className="text-yellow-500 animate-pulse absolute -top-1 -right-1" />;
      profileRingClass = 'border-yellow-500';
    } else if (rankNum === 2) {
      rankColorClass = 'text-slate-400 border-2 border-slate-400 bg-transparent shadow-md';
      borderClass = 'border-slate-300 dark:border-slate-400/50';
      bgClass = 'bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/40 dark:to-slate-700/30';
      profileRingClass = 'border-slate-400';
    } else if (rankNum === 3) {
      rankColorClass = 'text-amber-600 border-2 border-amber-600 bg-transparent shadow-md';
      borderClass = 'border-amber-600 dark:border-amber-700/50';
      bgClass = 'bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20';
      profileRingClass = 'border-amber-600';
    }

    return (
      <div 
        key={u.id} 
        onClick={() => onViewProfile(u.id)} 
        className={`p-3 rounded-[2rem] flex items-center gap-2 cursor-pointer hover:scale-[1.02] transition-all border-2 shadow-sm ${bgClass} ${borderClass} ${isCurrentUser ? 'ring-4 ring-primary/20' : ''}`}
      >
        <div className="relative shrink-0 w-8 h-8 flex items-center justify-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black ${rankColorClass}`}>
            {rankNum}
          </div>
          {starIcon}
        </div>
        <div className="shrink-0">
          <div className={`w-10 h-10 rounded-full overflow-hidden border-2 shadow-sm bg-gray-100 dark:bg-gray-900 ${profileRingClass}`}>
            {u.profilePicture ? (<img src={u.profilePicture} alt={u.username} className="w-full h-full object-cover" />) : (<div className="w-full h-full flex items-center justify-center text-gray-300"><User size={20} /></div>)}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1">
            <Username user={u} className="text-base sm:text-lg dark:text-white" />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-black text-primary">{getStatDisplay(u.stat, activeTab)}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
      <div className="shrink-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <Globe className="text-primary" size={20} />
              <h1 className="font-black text-lg text-gray-800 dark:text-white tracking-tight">Global Rankings</h1>
            </div>
            <div className="flex flex-col items-center -mt-1">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Data is estimated by AI</p>
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Updates Daily</p>
            </div>
          </div>
          <div className="w-10" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 pb-4">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
            {(['weight', 'area', 'pieces'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                  activeTab === tab 
                    ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-7xl mx-auto px-4 py-6 space-y-6 w-full pb-10 hide-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading rankings...</p>
          </div>
        ) : !features.leaderboard ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <Trophy className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={32} />
            <p className="text-sm font-bold text-gray-400">Global Rankings currently not available</p>
          </div>
        ) : (
          <>
            {userRankData && userRankData.position && (
              <div className="mb-8">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Your Position</h2>
                {renderUserBox(userRankData, userRankData.position, true)}
              </div>
            )}

            <div>
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Global Rankings</h2>
              <div className="space-y-3">
                {currentLeaderboard.length > 0 ? (
                  currentLeaderboard.map((u) => renderUserBox(u, u.position, u.id === user.id))
                ) : (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <Trophy className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={32} />
                    <p className="text-sm font-bold text-gray-400">No rankings available yet</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
