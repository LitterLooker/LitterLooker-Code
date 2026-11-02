
import React from 'react';

export const TagBadge: React.FC<{ tag: string }> = ({ tag }) => {
  const colors: Record<string, string> = {
    'Creator': 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800',
    'Tester': 'bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800',
    'OG': 'bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-900/40 dark:text-purple-400 dark:border-purple-800',
    'Verified': 'bg-green-100 text-green-600 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800'
  };
  return (
    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border tracking-tighter ${colors[tag] || 'bg-gray-100 text-gray-600'}`}>
      {tag}
    </span>
  );
};
