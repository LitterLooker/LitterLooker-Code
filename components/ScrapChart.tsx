import React, { useMemo } from 'react';
import { UserProfile } from '../types';
import { getLocalDateString } from '../utils';

export const ScrapChart: React.FC<{ user: UserProfile; allUsers: Record<string, UserProfile> }> = ({ user, allUsers }) => {
  const dates = useMemo(() => {
    const list = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      list.push(getLocalDateString(d));
    }
    return list;
  }, []);

  const userData = useMemo(() => dates.map(d => (user.dailyEarnings || {})[d] || 0), [dates, user.dailyEarnings]);
  
  const avgData = useMemo(() => {
    const userProfiles = Object.values(allUsers) as UserProfile[];
    const others = userProfiles.filter(u => u.id !== user.id && !u.isAdmin);
    
    return dates.map(d => {
      let sum = 0;
      let activeCount = 0;
      others.forEach(u => {
        const earned = (u.dailyEarnings || {})[d] || 0;
        if (earned > 0) {
          sum += earned;
          activeCount++;
        }
      });
      return activeCount > 0 ? Math.round(sum / activeCount) : 0;
    });
  }, [dates, allUsers, user.id]);

  // Dynamic max value for better scaling with a higher minimum and rounding
  const rawMax = Math.max(...userData, ...avgData, 2500);
  const maxVal = Math.ceil(rawMax / 100) * 100;
  
  const width = 340;
  const height = 180;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 35;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const getX = (i: number) => paddingLeft + (i * chartWidth / (dates.length - 1));
  const getY = (v: number) => height - paddingBottom - ((v / (maxVal || 1)) * chartHeight);

  const userPath = userData.map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(v)}`).join(' ');
  const avgPath = avgData.map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(v)}`).join(' ');
  const ticks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <div className="w-full h-52 bg-white/40 dark:bg-gray-800/40 backdrop-blur-md rounded-3xl border border-white/60 dark:border-gray-700/50 p-4 shadow-xl overflow-hidden animate-fade-in relative">
      <div className="flex justify-between items-center mb-1 px-1">
        <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Daily Activity</h4>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary" /><span className="text-[8px] font-bold text-gray-500 uppercase">You</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full border border-primary border-dashed" /><span className="text-[8px] font-bold text-gray-500 uppercase">Avg</span></div>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full drop-shadow-sm overflow-visible">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={paddingLeft} y1={getY(t)} x2={width - paddingRight} y2={getY(t)} stroke="#94a3b8" strokeOpacity="0.1" strokeWidth="1" />
            <text x={paddingLeft - 8} y={getY(t) + 3} textAnchor="end" fill="#94a3b8" fontSize="8" fontFamily="Inter, sans-serif" fontWeight="bold">
              {t}
            </text>
          </g>
        ))}
        <text x={10} y={height / 2} textAnchor="middle" fill="#94a3b8" fontSize="7" fontWeight="black" fontFamily="Inter, sans-serif" transform={`rotate(-90, 10, ${height / 2})`} opacity="0.6">XP</text>
        <path d={avgPath} fill="none" stroke="#00B7FF" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`${userPath} L ${getX(userData.length - 1)} ${height - paddingBottom} L ${getX(0)} ${height - paddingBottom} Z`} fill="url(#xpGradient)" opacity="0.15" />
        <path d={userPath} fill="none" stroke="#00B7FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {userData.map((v, i) => (
          <circle key={i} cx={getX(i)} cy={getY(v)} r="3.5" fill="#00B7FF" />
        ))}
        {dates.map((d, i) => {
           const [y, m, dayNum] = d.split('-').map(Number);
           const localD = new Date(y, m - 1, dayNum);
           return (
            <text key={i} x={getX(i)} y={height - 12} textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="black">
              {localD.toLocaleDateString([], { weekday: 'short' }).toUpperCase()}
            </text>
           );
        })}
        <defs>
          <linearGradient id="xpGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00B7FF" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};