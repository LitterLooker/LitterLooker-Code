import React, { useState, useEffect } from 'react';
import { ICONS, EDUCATIONAL_TRIVIA_TIPS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle } from 'lucide-react';
import { useIsDarkMode } from '../utils';

export const LoadingAuth: React.FC<{ isLowPower: boolean }> = ({ isLowPower }) => {
  const transitionDuration = isLowPower ? 0 : 1.2;
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const isDarkMode = useIsDarkMode();

  useEffect(() => {
    // Randomize initial tip
    const initialIndex = Math.floor(Math.random() * EDUCATIONAL_TRIVIA_TIPS.length);
    setCurrentTipIndex(initialIndex);

    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % EDUCATIONAL_TRIVIA_TIPS.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      className="fixed inset-0 z-[10000] pointer-events-auto loading-auth-container"
      initial={{ opacity: 1 }}
      exit={{ transition: { duration: transitionDuration } }}
    >
      {/* Top Shutter */}
      <motion.div
        className="absolute top-0 left-0 w-full bg-primary dark:bg-[#023020] overflow-hidden pointer-events-auto"
        style={{ height: '50.5%' }}
        exit={{ 
          y: ["0%", "0%", "-100%"], 
          transition: { duration: transitionDuration, times: [0, 0.4, 1], ease: [0.8, 0, 0.2, 1] } 
        }}
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white rounded-full blur-[100px] animate-pulse" />
        </div>
        
        {/* Top Mint Green Line */}
        <motion.div
          className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#6ee7b7]/80 dark:from-[#15803d]/80 to-transparent"
          style={{ height: '32px' }}
          initial={{ opacity: 0 }}
          exit={{ 
            opacity: [0, 1, 1],
            transition: { duration: transitionDuration, times: [0, 0.2, 1] } 
          }}
        />
      </motion.div>

      {/* Bottom Shutter */}
      <motion.div
        className="absolute bottom-0 left-0 w-full bg-primary dark:bg-[#023020] overflow-hidden pointer-events-auto"
        style={{ height: '50.5%' }}
        exit={{ 
          y: ["0%", "0%", "100%"], 
          transition: { duration: transitionDuration, times: [0, 0.4, 1], ease: [0.8, 0, 0.2, 1] } 
        }}
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white rounded-full blur-[100px] animate-pulse delay-700" />
        </div>

        {/* Bottom Mint Green Line */}
        <motion.div
          className="absolute top-0 left-0 w-full bg-gradient-to-b from-[#6ee7b7]/80 dark:from-[#15803d]/80 to-transparent"
          style={{ height: '32px' }}
          initial={{ opacity: 0 }}
          exit={{ 
            opacity: [0, 1, 1],
            transition: { duration: transitionDuration, times: [0, 0.2, 1] } 
          }}
        />
      </motion.div>

      {/* Normal Loading Foreground Content */}
      <motion.div 
        className="absolute inset-0 flex flex-col items-center justify-between py-12 pointer-events-none z-10"
        exit={{ 
          opacity: [1, 1, 0], 
          scale: [1, 1, 0.95],
          transition: { duration: transitionDuration, times: [0, 0.4, 1] } 
        }}
      >
        {/* Top empty space to center the middle section */}
        <div />

        {/* Center content */}
        <div className="flex flex-col items-center gap-6 animate-fade-in pointer-events-none">
          <div className="animate-bounce-slow">
            <img src={isDarkMode ? "/Graphics/LitterLookerTitleDark.png?v=2" : ICONS.TITLE} alt="LitterLooker" className="w-80 h-40 object-contain" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 loading-dots">
              <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
            </div>
          </div>
        </div>

        {/* Dynamic Educational Tip Card */}
        <div className="w-full max-w-sm px-6 pointer-events-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTipIndex}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-3xl space-y-2 shadow-xl flex flex-col items-center text-center"
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-full">
                <HelpCircle size={10} /> Did You Know?
              </span>
              <p className="text-xs font-semibold text-white/90 leading-relaxed">
                {EDUCATIONAL_TRIVIA_TIPS[currentTipIndex]}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};


