import React, { useMemo } from 'react';

export const Confetti: React.FC = () => {
  const particles = useMemo(() => Array.from({ length: 100 }, (_, i) => ({
    id: i,
    left: Math.random() * 100 + '%',
    top: -20 - Math.random() * 20 + 'px',
    size: Math.random() * 8 + 4 + 'px',
    animationDelay: Math.random() * 0.5 + 's',
    duration: 2 + Math.random() * 2 + 's',
    color: ['#00B7FF', '#10B981', '#ffffff', '#ff00ff', '#00ff00', '#FF4444', '#FFAA00'][Math.floor(Math.random() * 7)],
    rotation: Math.random() * 360 + 'deg'
  })), []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[1100] overflow-hidden">
      {particles.map(p => (
        <div 
          key={p.id} 
          className="absolute animate-confetti-fall" 
          style={{ 
            left: p.left, 
            top: p.top,
            width: p.size,
            height: p.size,
            backgroundColor: p.color, 
            animationDelay: p.animationDelay,
            animationDuration: p.duration,
            transform: `rotate(${p.rotation})`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px'
          }} 
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          25% { transform: translateY(25vh) translateX(20px) rotate(90deg); }
          50% { transform: translateY(50vh) translateX(-20px) rotate(180deg); }
          75% { transform: translateY(75vh) translateX(20px) rotate(270deg); }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }
        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  );
};