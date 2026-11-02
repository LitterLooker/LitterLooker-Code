import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { LitterStats } from '../types';

interface HistoryEntry extends LitterStats {
  timestamp: number;
}

interface LitterStatsGraphProps {
  history: HistoryEntry[];
  title: string;
}

type TimePeriod = '1D' | '1W' | '1M' | '1Y';

export const LitterStatsGraph: React.FC<LitterStatsGraphProps> = ({ history, title }) => {
  const [period, setPeriod] = useState<TimePeriod>('1M');

  const filteredData = useMemo(() => {
    if (!history || history.length === 0) return [];

    const now = Date.now();
    let startTime = 0;

    switch (period) {
      case '1D': startTime = now - 24 * 60 * 60 * 1000; break;
      case '1W': startTime = now - 7 * 24 * 60 * 60 * 1000; break;
      case '1M': startTime = now - 30 * 24 * 60 * 60 * 1000; break;
      case '1Y': startTime = now - 365 * 24 * 60 * 60 * 1000; break;
    }

    const filtered = history.filter(h => h.timestamp >= startTime);
    
    // Sort by timestamp
    const sorted = [...filtered].sort((a, b) => a.timestamp - b.timestamp);

    // Accumulate stats for growth chart
    let accWeight = 0;
    let accArea = 0;
    let accPieces = 0;

    return sorted.map(h => {
      accWeight += h.weightKg || 0;
      accArea += h.areaSqM || 0;
      accPieces += h.piecesCount || 0;
      return {
        ...h,
        date: new Date(h.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        cumulativeWeight: Number(accWeight.toFixed(2)),
        cumulativeArea: Number(accArea.toFixed(2)),
        cumulativePieces: accPieces,
      };
    });
  }, [history, period]);

  if (!history || history.length === 0) {
    return (
      <div className="h-32 flex flex-col items-center justify-center text-gray-400/50 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-[2rem]">
        <div className="w-8 h-8 rounded-full border-2 border-dashed border-current mb-2 animate-pulse" />
        <span className="text-[8px] font-black uppercase tracking-[0.2em]">Awaiting Data Stream</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
        <div>
          <p className="text-[11px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-tighter flex items-center gap-2">
            Impact
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100/50 dark:bg-gray-800/50 p-1 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
          {(['1D', '1W', '1M', '1Y'] as TimePeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all duration-300 ${
                period === p 
                  ? 'bg-white dark:bg-gray-700 text-primary shadow-sm scale-105' 
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 w-full -ml-4 relative">
        {/* Hardware-style grid overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.07]" 
             style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPieces" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="currentColor" opacity={0.1} />
            <XAxis 
              dataKey="date" 
              fontSize={8} 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: 'currentColor', opacity: 0.5, fontWeight: 900 }}
              dy={10}
            />
            <YAxis 
              fontSize={8} 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: 'currentColor', opacity: 0.5, fontWeight: 900 }}
              dx={-5}
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '1.5rem', 
                border: '1px solid rgba(0,0,0,0.1)', 
                boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
                fontSize: '10px',
                fontWeight: 900,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(12px)',
                padding: '16px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
              itemStyle={{ padding: '4px 0' }}
              cursor={{ stroke: '#10b981', strokeWidth: 2, strokeDasharray: '6 6' }}
            />
            <Area 
              type="monotone" 
              dataKey="cumulativeWeight" 
              name="Weight (kg)"
              stroke="#10b981" 
              strokeWidth={4}
              fillOpacity={1} 
              fill="url(#colorWeight)" 
              animationDuration={2000}
              activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
            />
            <Area 
              type="monotone" 
              dataKey="cumulativeArea" 
              name="Area (m²)"
              stroke="#6366f1" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorArea)"
              animationDuration={2000}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#6366f1' }}
            />
            <Area 
              type="monotone" 
              dataKey="cumulativePieces" 
              name="Pieces"
              stroke="#f59e0b" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorPieces)"
              animationDuration={2000}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#f59e0b' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-center text-[8px] font-black text-gray-400/40 uppercase tracking-[0.2em] pt-1 mt-4">Data Estimated by AI</p>
    </div>
  );
};
