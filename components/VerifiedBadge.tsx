import React from 'react';
import { Leaf, Check } from 'lucide-react';

export const VerifiedBadge: React.FC<{ size?: number; color?: string; checkColor?: string; className?: string }> = ({ 
  size = 12, 
  color = "#22c55e", 
  checkColor = "white",
  className = ""
}) => (
  <span className={`relative inline-flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size }}>
    <Leaf 
      size={size} 
      fill={color} 
      stroke={color} 
      strokeWidth={1}
    />
    <Check 
      size={size * 0.6} 
      className="absolute" 
      style={{ color: checkColor }} 
      strokeWidth={4} 
    />
  </span>
);