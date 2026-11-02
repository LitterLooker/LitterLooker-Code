
import React from 'react';
import { getRankInfo, getRankIconPath } from '../utils';

export const RankBadge: React.FC<{ points: number; size?: 'sm' | 'md' | 'lg'; onClick?: (e: React.MouseEvent) => void }> = ({ points, size = 'sm', onClick }) => {
  const rank = getRankInfo(points);
  const sizeClasses = { sm: 'text-[10px] px-2 py-1 gap-1.5', md: 'text-xs px-3 py-1.5 gap-2', lg: 'text-sm px-4 py-2 gap-2.5' };
  const iconSize = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' };
  
  if (rank.level === 15) return (
    <div onClick={onClick} className={`inline-flex items-center rounded-full bg-gradient-to-r from-green-700 via-green-800 to-green-900 border-2 border-green-600 shadow-[0_2px_8px_rgba(20,83,45,0.4)] cursor-pointer hover:scale-105 transition-transform ${sizeClasses[size]}`}>
      <div className="rounded-full overflow-hidden">
        <img src={getRankIconPath(rank.name)} alt={rank.name} className={`${iconSize[size]} object-contain`} />
      </div>
      <span className="font-black uppercase tracking-wider text-white drop-shadow-[0_1px_0px_rgba(0,0,0,0.5)]">{rank.name}</span>
    </div>
  );

  if (rank.level === 14) return (
    <div onClick={onClick} className={`inline-flex items-center rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 border border-slate-300 shadow-sm cursor-pointer hover:scale-105 transition-transform ${sizeClasses[size]}`}>
      <div className="rounded-full overflow-hidden">
        <img src={getRankIconPath(rank.name)} alt={rank.name} className={`${iconSize[size]} object-contain animate-pulse`} />
      </div>
      <span className="font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-slate-600 via-slate-400 to-slate-600 drop-shadow-sm animate-pulse">{rank.name}</span>
    </div>
  );

  if (rank.level === 13) return (
    <div onClick={onClick} className={`inline-flex items-center rounded-full bg-gradient-to-r from-orange-200 via-orange-100 to-orange-200 border border-orange-300 shadow-sm cursor-pointer hover:scale-105 transition-transform ${sizeClasses[size]}`}>
      <div className="rounded-full overflow-hidden">
        <img src={getRankIconPath(rank.name)} alt={rank.name} className={`${iconSize[size]} object-contain animate-pulse`} />
      </div>
      <span className="font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-orange-800 via-orange-600 to-orange-800 drop-shadow-sm animate-pulse">{rank.name}</span>
    </div>
  );

  return (
    <div onClick={onClick} className={`inline-flex items-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-105 transition-all ${sizeClasses[size]}`}>
      <div className="rounded-full overflow-hidden">
        <img src={getRankIconPath(rank.name)} alt={rank.name} className={`${iconSize[size]} object-contain`} />
      </div>
      <span className="font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">{rank.name}</span>
    </div>
  );
};
