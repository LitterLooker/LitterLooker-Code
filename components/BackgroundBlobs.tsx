import React from 'react';
import { motion } from 'motion/react';
import { Leaf } from 'lucide-react';

export const BackgroundBlobs: React.FC = () => {
  const transition = { duration: 15, repeat: Infinity, ease: "easeInOut" };
  const transitionSecondary = { duration: 20, repeat: Infinity, ease: "easeInOut" };
  const transitionTertiary = { duration: 18, repeat: Infinity, ease: "easeInOut" };
  const transitionAccent = { duration: 12, repeat: Infinity, ease: "easeInOut" };
  const transitionLeaf = { duration: 12, repeat: Infinity, ease: "easeInOut" };

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden background-blobs">
      {/* Primary Blob - Large & Vibrant */}
      <motion.div 
        animate={{ 
          scale: [1, 1.4, 1],
          x: [0, 60, 0],
          y: [0, 100, 0],
          rotate: [0, 45, 0]
        }}
        transition={transition}
        className="absolute -top-24 -left-24 w-[500px] h-[500px] bg-primary/25 dark:bg-primary/30 rounded-full blur-[120px]"
      />
      
      {/* Secondary Blob - Contrasting Position */}
      <motion.div 
        animate={{ 
          scale: [1.4, 1, 1.4],
          x: [0, -80, 0],
          y: [0, -120, 0],
          rotate: [0, -30, 0]
        }}
        transition={transitionSecondary}
        className="absolute top-1/3 -right-32 w-[450px] h-[450px] bg-green-600/25 dark:bg-green-600/30 rounded-full blur-[120px]"
      />
      
      {/* Tertiary Blob - Bottom Accent */}
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          x: [0, 50, 0],
          y: [0, -70, 0],
        }}
        transition={transitionTertiary}
        className="absolute -bottom-32 left-1/4 w-[400px] h-[400px] bg-green-400/25 dark:bg-green-400/30 rounded-full blur-[100px]"
      />

      {/* Accent Blob - Center Soft Glow */}
      <motion.div 
        animate={{ 
          opacity: [0.1, 0.2, 0.1],
          scale: [0.8, 1.1, 0.8]
        }}
        transition={transitionAccent}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 dark:bg-primary/15 rounded-full blur-[150px]"
      />
      
      {/* Floating Leaves - More numerous and varied */}
      {[...Array(10)].map((_, i) => (
        <motion.div
           key={i}
          initial={{ 
            x: Math.random() * 400 - 200, 
            y: Math.random() * 800 + 200, 
            rotate: 0,
            opacity: 0 
          }}
          animate={{ 
            y: [null, -200],
            x: [null, Math.random() * 150 - 75],
            rotate: [0, 720],
            opacity: [0, 0.5, 0]
          }}
          transition={transitionLeaf}
          className="absolute text-primary/30 dark:text-primary/50 pointer-events-none"
          style={{ left: `${Math.random() * 100}%` }}
        >
          <Leaf size={16 + Math.random() * 32} />
        </motion.div>
      ))}
    </div>
  );
};
