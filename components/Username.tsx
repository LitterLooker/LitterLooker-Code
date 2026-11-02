
import React from 'react';
import { UserProfile } from '../types';
import { getUserFullName, getUserFirstName } from '../utils';

export const Username: React.FC<{ user: UserProfile | Partial<UserProfile>; className?: string; firstNameOnly?: boolean }> = ({ user, className = "", firstNameOnly = false }) => {
  const style: React.CSSProperties = {
    display: 'inline-block',
    verticalAlign: 'middle',
    fontSize: 'inherit',
    textTransform: 'inherit'
  };
  
  if (user.usernameGradient) {
    style.backgroundImage = `linear-gradient(to right, ${user.usernameGradient[0]}, ${user.usernameGradient[1]})`;
    style.WebkitBackgroundClip = 'text';
    style.WebkitTextFillColor = 'transparent';
    style.backgroundClip = 'text';
  } else if (user.usernameColor) {
    style.color = user.usernameColor;
  }

  const shineClass = user.usernameShine ? (user.usernameGradient ? 'username-shine-overlay' : 'animate-shine') : '';
  const displayName = firstNameOnly 
    ? getUserFirstName(user) 
    : (user.username && user.username.trim() ? user.username.trim() : getUserFullName(user));

  return (
    <span style={style} className={`${className} font-black ${shineClass}`} data-text={user.usernameShine && user.usernameGradient ? displayName : undefined}>
      {displayName}
    </span>
  );
};
