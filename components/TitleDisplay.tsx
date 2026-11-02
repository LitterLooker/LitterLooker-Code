import React from 'react';
import { ACHIEVEMENTS_DATA, TITLE_RARITY_MAP } from '../constants';

export const TitleDisplay: React.FC<{ title: string; size?: 'xs' | 'sm' | 'md' }> = ({ title, size = 'sm' }) => {
  const achievement = ACHIEVEMENTS_DATA.find(a => a.title === title);
  const rarity = achievement?.rarity || TITLE_RARITY_MAP[title] || 'Common';
  const sizeClasses = { xs: 'text-[8px]', sm: 'text-[9px]', md: 'text-[10px]' };
  const rarityClasses = { 
    Common: 'text-gray-400 dark:text-gray-500', 
    Rare: 'text-blue-500 font-bold', 
    Legendary: 'text-yellow-500 font-black' 
  };
  return (
    <span className={`${sizeClasses[size]} ${rarityClasses[rarity]} uppercase tracking-widest italic`}>
      « {title} »
    </span>
  );
};