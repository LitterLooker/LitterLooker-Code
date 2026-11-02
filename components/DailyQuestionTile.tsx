import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy, Flame, CheckCircle2, XCircle, HelpCircle, Play, ChevronUp, Coins, ChevronLeft, ChevronRight, RotateCcw, Zap } from 'lucide-react';
import { DailyQuestion, DAILY_QUESTIONS } from '../constants';
import { UserProfile } from '../types';
import { getLocalDateString } from '../utils';

const TRIVIA_TIPS = [
  "A simple plastic bottle can take up to 450 years to fully decompose in nature.",
  "Despite being small, cigarette butts are the most littered item across the entire world.",
  "Unlike plastics, aluminum is unique because it can be recycled endlessly without any loss of quality.",
  "Sadly, more than 100,000 marine animals die every single year due to plastic pollution in their habitats.",
  "A single glass bottle takes about one million years to break down naturally.",
  "Globally, humanity consumes an astonishing one trillion plastic bags every single year.",
  "It takes about 80 to 200 years for an ordinary aluminum beverage can to decompose.",
  "Recent scientific studies estimate that up to 90% of all seabirds have swallowed plastic waste.",
  "Glass is one of the few materials that can be recycled endlessly with zero degradation in strength.",
  "Sea turtles often mistake floating plastic bags for jellyfish, which are their natural prey.",
  "On average, a person in the United States produces about 4.9 pounds of waste every day."
];

interface DailyQuestionTileProps {
  user: UserProfile;
  allUsers: Record<string, UserProfile>;
  onAnswer: (history: any[], timeLeft: number) => Promise<void>;
  onEndChallenge: (corrects: number, reward: number, history: any[]) => Promise<void>;
  onUseSpark?: () => Promise<void>;
  onSetFullScreen?: (full: boolean) => void;
}

export const DailyQuestionTile: React.FC<DailyQuestionTileProps> = ({ user, allUsers, onAnswer, onEndChallenge, onUseSpark, onSetFullScreen }) => {
  const today = getLocalDateString();
  const hasEndedChallengeToday = user.hasEndedChallengeToday;
  
  const [hasStarted, setHasStarted] = useState(!!user.currentChallengeHistory?.length);
  const [timeLeft, setTimeLeft] = useState(user.currentChallengeTimeLeft ?? 60);
  const [isTimerActive, setIsTimerActive] = useState(false);
  
  // Compute correct and wrong from history
  const initialHistory = user.currentChallengeHistory || [];
  const initialCorrect = initialHistory.filter(h => h.correct).length;
  const initialWrong = initialHistory.filter(h => !h.correct).length;
  
  const [correctCount, setCorrectCount] = useState(initialCorrect);
  const [wrongCount, setWrongCount] = useState(initialWrong);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialHistory.length);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [challengeHistory, setChallengeHistory] = useState<{questionIndex: number, correct: boolean, selectedOption: number}[]>(initialHistory);
  const [isReviewing, setIsReviewing] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const [isPreparing, setIsPreparing] = useState(false);
  const [preparationTip, setPreparationTip] = useState("");

  const lobbyTip = useMemo(() => {
    // Select stable daily tip based on today's day of month
    const day = today ? parseInt(today.split('-')[2] || '0', 10) : new Date().getDate();
    return TRIVIA_TIPS[day % TRIVIA_TIPS.length];
  }, [today]);

  const streak = user.dailyStreak || 0;
  const isStreakVulnerable = !!(
    (user.isStreakSavedBySpark || (user.streakSavedDate && user.lastDailyAnsweredDate !== today)) &&
    streak > 0
  );

  // Reset logic for new day and sync with props
  useEffect(() => {
    const isNewDay = user.lastDailyAnsweredDate !== today;
    const propsHistory = user.currentChallengeHistory || [];
    
    if (isNewDay || propsHistory.length === 0) {
      if (hasStarted && !isTimerActive) {
        setHasStarted(false);
        setTimeLeft(60);
        setCorrectCount(0);
        setWrongCount(0);
        setChallengeHistory([]);
        setCurrentQuestionIndex(0);
      }
    } else if (propsHistory.length !== challengeHistory.length) {
      // Sync if props are more up to date or different
      setChallengeHistory(propsHistory);
      setCurrentQuestionIndex(propsHistory.length);
      setCorrectCount(propsHistory.filter(h => h.correct).length);
      setWrongCount(propsHistory.filter(h => !h.correct).length);
      setTimeLeft(user.currentChallengeTimeLeft ?? 60);
      setHasStarted(true);
    }
  }, [today, user.id, user.currentChallengeHistory, user.currentChallengeTimeLeft]);

  // Full-screen state notification
  useEffect(() => {
    onSetFullScreen?.(isTimerActive || isSummarizing || isReviewing || isPreparing);
  }, [isTimerActive, isSummarizing, isReviewing, isPreparing, onSetFullScreen]);

  // XP ESTIMATE calculation
  const XP_ESTIMATE = useMemo(() => {
    return Math.max(0, (correctCount - wrongCount) * 50);
  }, [correctCount, wrongCount]);

  // Select questions for the challenge session
  const sessionQuestions = useMemo(() => {
    const seed = `${user.id}-${today}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    
    const uniqueQuestions: DailyQuestion[] = [];
    const seen = new Set();
    for (const q of DAILY_QUESTIONS) {
      if (!seen.has(q.question)) {
        seen.add(q.question);
        uniqueQuestions.push(q);
      }
    }

    const shuffled = [...uniqueQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      hash = (Math.abs(hash * 16807)) % 2147483647;
      const j = hash % (i + 1);
      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }
    return shuffled;
  }, [user.id, today]);

  const currentQuestion = sessionQuestions[currentQuestionIndex % sessionQuestions.length];

  // Timer logic
  useEffect(() => {
    let timer: any;
    if (isTimerActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerActive) {
      handleChallengeEnd();
    }
    return () => clearInterval(timer);
  }, [isTimerActive, timeLeft]);

  // Pause timer when clicking away
  useEffect(() => {
    const handleBlur = () => {
      if (isTimerActive) {
        setIsTimerActive(false);
      }
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [isTimerActive]);

  const handleStart = () => {
    // Select a random educational tip that is actually an answer to one of the questions
    const randomTip = TRIVIA_TIPS[Math.floor(Math.random() * TRIVIA_TIPS.length)];
    setPreparationTip(randomTip);
    setIsPreparing(true);
    setHasStarted(true);

    if (challengeHistory.length === 0) {
      setTimeLeft(60);
      setCorrectCount(0);
      setWrongCount(0);
      setChallengeHistory([]);
      setCurrentQuestionIndex(0);
    }

    setTimeout(() => {
      setIsPreparing(false);
      setIsTimerActive(true);
    }, 4000);
  };

  const handleChallengeEnd = async () => {
    setIsTimerActive(false);
    setIsSummarizing(true);
    
    // Updated Formula: (#correct-#incorrect)*50
    // If #incorrect > #correct, streak = 0, reward = 0
    let finalReward = (correctCount - wrongCount) * 50;
    if (wrongCount > correctCount) {
        finalReward = 0;
        // In onEndChallenge, we will handle the streak reset if reward is 0
    } else {
        finalReward = Math.max(0, finalReward); // Ensure non-negative
    }
    
    try {
      await onEndChallenge(correctCount, finalReward, challengeHistory);
    } catch (error) {
      console.error("Error ending challenge:", error);
    }
  };

  const handleOptionClick = (idx: number) => {
    if (!isTimerActive || selectedOption !== null) return;

    setSelectedOption(idx);
    const isCorrect = idx === currentQuestion.correctIndex;
    
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
      setShowFeedback('correct');
    } else {
      setWrongCount(prev => prev + 1);
      setShowFeedback('wrong');
    }

    const originalIndex = DAILY_QUESTIONS.findIndex(q => q.question === currentQuestion.question);
    const newHistory = [...challengeHistory, { questionIndex: originalIndex, correct: isCorrect, selectedOption: idx }];
    setChallengeHistory(newHistory);

    onAnswer(newHistory, timeLeft).catch(console.error);

    setTimeout(() => {
      setSelectedOption(null);
      setShowFeedback(null);
      setCurrentQuestionIndex(prev => prev + 1);
    }, 600);
  };

  const handleUseSpark = async () => {
    if (onUseSpark) {
      await onUseSpark();
      setIsSummarizing(false);
      setHasStarted(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const finalHistory = challengeHistory.length > 0 ? challengeHistory : (user.currentChallengeHistory || []);

  if (isReviewing && finalHistory.length > 0) {
    return (
      <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-white dark:bg-gray-950" onClick={() => setIsReviewing(false)} />
        <div className="relative w-full h-full max-w-7xl bg-white dark:bg-gray-950 flex flex-col pt-28 pb-16 overflow-hidden">
          <div className="p-4 shrink-0 flex items-center justify-between border-b dark:border-gray-800">
          <button onClick={() => setIsReviewing(false)} className="flex items-center gap-2 text-gray-500 font-bold text-sm uppercase tracking-widest hover:text-primary transition-colors">
            <ChevronLeft size={18} /> Back
          </button>
          <div className="text-center flex flex-col">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reviewing</span>
            <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">Question {currentReviewIndex + 1} of {finalHistory.length}</span>
          </div>
          <div className="w-10" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${finalHistory[currentReviewIndex]?.correct ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {finalHistory[currentReviewIndex]?.correct ? 'Correct' : 'Incorrect'}
                </div>
              </div>
              <h3 className="text-xl md:text-2xl font-black text-center text-gray-900 dark:text-white leading-tight">
                {DAILY_QUESTIONS[finalHistory[currentReviewIndex]?.questionIndex]?.question || 'Question no longer available'}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {DAILY_QUESTIONS[finalHistory[currentReviewIndex]?.questionIndex]?.options?.map((opt, i) => {
                const isCorrect = i === DAILY_QUESTIONS[finalHistory[currentReviewIndex]?.questionIndex]?.correctIndex;
                const isSelected = i === finalHistory[currentReviewIndex]?.selectedOption;
                
                let bgClass = "bg-gray-50 dark:bg-gray-900 border-transparent text-gray-400 opacity-50";
                if (isCorrect) bgClass = "bg-green-500/10 border-green-500 text-green-600 dark:text-green-400 opacity-100";
                if (isSelected && !isCorrect) bgClass = "bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 opacity-100";

                return (
                  <div key={i} className={`p-4 rounded-2xl border-2 font-bold text-sm flex flex-col items-center justify-center text-center h-16 ${bgClass}`}>
                    <span className="leading-tight line-clamp-2">{opt}</span>
                    <div className="absolute top-1 right-1 opacity-50">
                      {isCorrect && <CheckCircle2 size={12} />}
                      {isSelected && !isCorrect && <XCircle size={12} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-6 border-t dark:border-gray-800 flex items-center justify-between shrink-0 bg-white dark:bg-gray-950">
          <button 
            disabled={currentReviewIndex === 0}
            onClick={() => setCurrentReviewIndex(prev => prev - 1)}
            className="p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-500 disabled:opacity-30 transition-all active:scale-90"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-wrap justify-center gap-2 max-w-[200px]">
            {finalHistory.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentReviewIndex ? 'bg-primary w-4' : 'bg-gray-300 dark:bg-gray-700'}`} />
            ))}
          </div>
          <button 
            disabled={currentReviewIndex === finalHistory.length - 1}
            onClick={() => setCurrentReviewIndex(prev => prev + 1)}
            className="p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-500 disabled:opacity-30 transition-all active:scale-90"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </div>
    );
  }

  // Summary screen
  if (isSummarizing) {
    const corrects = finalHistory.filter(h => h.correct).length;
    const wrongs = finalHistory.filter(h => !h.correct).length;
    
    const finalReward = challengeHistory.length > 0 ? Math.max(0, (corrects - wrongs) * 50) : (user.currentChallengeReward || 0);

    return (
      <div className="fixed inset-0 z-[205] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          onClick={() => !isSummarizing && setIsExpanded(false)}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative w-full max-w-xs bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 shadow-2xl flex flex-col items-center overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-primary" />
          
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4">
            <Trophy size={24} />
          </div>

          <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-1">Challenge Over!</h2>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Session Performance</p>

          <div className="grid grid-cols-2 gap-2 w-full mb-6">
            <div className="bg-green-50 dark:bg-green-500/5 p-4 rounded-3xl border border-green-100 dark:border-green-500/10 text-center">
              <p className="text-[8px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest mb-0.5">Correct</p>
              <p className="text-2xl font-black text-green-700 dark:text-green-300">{corrects}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-500/5 p-4 rounded-3xl border border-red-100 dark:border-red-500/10 text-center">
              <p className="text-[8px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-0.5">Wrong</p>
              <p className="text-2xl font-black text-red-700 dark:text-red-300">{wrongs}</p>
            </div>
          </div>

          <div className="w-full space-y-2 mb-6">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">XP Reward</span>
              <span className="text-sm font-black text-primary">+{finalReward.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Current Streak</span>
                {isStreakVulnerable && (
                  <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-tight flex items-center gap-0.5 mt-0.5">
                    <Zap size={8} className="fill-current text-amber-500" /> Saved by Spark (Vulnerable)
                  </span>
                )}
              </div>
              <span className={`text-sm font-black flex items-center gap-1.5 ${isStreakVulnerable ? 'text-slate-500 dark:text-slate-400' : 'text-orange-500'}`}>
                <Flame size={14} fill="currentColor" className={isStreakVulnerable ? 'text-slate-400 dark:text-slate-500 opacity-70' : 'text-orange-500'} />
                <span>{user.dailyStreak || 0}</span>
                {isStreakVulnerable && (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700/60">
                    VULNERABLE
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="w-full space-y-2">
            {finalHistory.length > 0 && (
              <button 
                onClick={(e) => { 
                  e.stopPropagation();
                  setIsReviewing(true); 
                  setIsSummarizing(false); 
                  setCurrentReviewIndex(0); 
                }}
                className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={12} /> Review
              </button>
            )}
            
            {corrects === 0 && (user.sparks || 0) > 0 && onUseSpark && (user.previousDailyStreak || 0) > 1 && (
              <button 
                onClick={handleUseSpark}
                className="w-full py-3 bg-orange-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Zap size={12} /> Use Spark
              </button>
            )}

            <button 
              onClick={() => { setHasStarted(false); setIsSummarizing(false); }}
              className="w-full py-3 bg-primary text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              Close Summary
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Challenge Preparing screen
  if (hasStarted && isPreparing) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white dark:bg-[#0a0f18]" id="loading-tip-container">
        <div className="w-full max-w-sm px-6 text-center space-y-8 flex flex-col items-center justify-center h-full">
          {/* Animated Countdown/Icon */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Outer spinning ring */}
            <div className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <Sparkles size={40} className="text-primary animate-pulse" id="loading-tip-icon" />
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter" id="loading-tip-title">Get Ready!</h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] opacity-85 leading-none">Daily Challenge is loading...</p>
          </div>

          {/* Fact card with beautiful styling */}
          <div className="w-full p-6 bg-primary/5 dark:bg-primary/10 border border-primary/10 rounded-3xl space-y-3 shadow-sm animate-pulse-subtle" id="loading-tip-card">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest rounded-full">
              <HelpCircle size={10} /> Did You Know?
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 leading-relaxed text-center">
              {preparationTip}
            </p>
          </div>

          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-pulse">
            Loading questions...
          </p>
        </div>
      </div>
    );
  }

  // Challenge Active screen
  if (hasStarted && isTimerActive) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center">
        <div className="absolute inset-0 bg-white dark:bg-gray-950" />
        <div className="relative w-full h-full max-w-7xl flex flex-col overflow-hidden pt-28 pb-16">
          {/* Question Area */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-50/30 dark:bg-gray-900/10 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentQuestionIndex}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-lg space-y-8"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4 px-2">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Time</span>
                    <span className={`text-lg font-black ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-gray-900 dark:text-white'}`}>
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                  <div className="bg-primary/10 text-primary px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                    Question {currentQuestionIndex + 1}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Streak</span>
                    <div className={`flex items-center gap-1.5 ${isStreakVulnerable ? 'text-slate-400 dark:text-slate-500' : 'text-orange-500'}`}>
                      <Flame size={13} fill="currentColor" className={isStreakVulnerable ? 'text-slate-400 opacity-60' : 'text-orange-500'} />
                      <span className="text-lg font-black">{streak}</span>
                      {isStreakVulnerable && (
                        <span className="text-[8px] font-black uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded border border-amber-300 dark:border-amber-700/60">
                          SAVED
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <h1 className="text-xl md:text-2xl font-black text-center text-gray-900 dark:text-white leading-tight px-4 min-h-[4rem] flex items-center justify-center">
                  {currentQuestion.question}
                </h1>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                {currentQuestion.options.map((opt, i) => {
                  const isSelected = selectedOption === i;
                  const isCorrect = i === currentQuestion.correctIndex;
                  let bgClass = "bg-white dark:bg-gray-900 border-2 dark:border-gray-800 hover:border-primary/30 transition-all text-xs";
                  
                  if (isSelected) {
                    bgClass = isCorrect ? "bg-green-500 text-white border-green-500 shadow-xl shadow-green-500/20" : "bg-red-50 text-red-500 border-red-500";
                  }
                  
                  if (selectedOption !== null && i === currentQuestion.correctIndex && !isSelected) {
                    bgClass = "border-green-500 text-green-600 dark:text-green-400";
                  }

                  return (
                    <button 
                      key={i}
                      onClick={() => handleOptionClick(i)}
                      disabled={selectedOption !== null}
                      className={`p-4 rounded-2xl text-left font-semibold transition-all active:scale-95 h-16 flex flex-col justify-center ${bgClass}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
    );
  }

  // Intro screen
  return (
    <div className="w-full">
      <motion.div 
        layout
        onClick={() => {
          if (hasEndedChallengeToday) {
            setIsSummarizing(true);
          } else {
            setIsExpanded(prev => !prev);
          }
        }}
        className={`w-full bg-gray-50 dark:bg-[#1f2937] rounded-[2rem] p-4 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden relative group cursor-pointer ${isExpanded ? 'p-6' : 'p-4'} ${!hasEndedChallengeToday ? 'animate-pulse-subtle' : ''}`}
      >
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1 min-w-0">
              <div className="flex items-center gap-4">
                <div 
                  className={`px-3 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-sm gap-1.5 transition-all ${
                    isStreakVulnerable
                      ? 'bg-slate-200/90 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 border-2 border-dashed border-amber-500/50 shadow-inner'
                      : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                  }`}
                  title={isStreakVulnerable ? "Streak saved by a Spark — Vulnerable! Complete today's challenge to rekindle." : "Daily Streak"}
                >
                  <Flame size={14} fill="currentColor" className={isStreakVulnerable ? 'text-slate-400 dark:text-slate-500 opacity-60' : ''} /> 
                  <span className={isStreakVulnerable ? 'opacity-90' : ''}>{streak}</span>
                  {isStreakVulnerable && (
                    <Zap size={9} className="fill-current text-amber-500 -ml-0.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter truncate whitespace-nowrap">Daily Challenge</h3>
                  {!isExpanded && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isStreakVulnerable && (
                        <span className="text-[8px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700/60 flex items-center gap-0.5">
                          <Zap size={8} className="fill-current" /> Vulnerable
                        </span>
                      )}
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate whitespace-nowrap">
                        {hasEndedChallengeToday ? 'review summary' : 'click to begin'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {isExpanded && (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                className="p-1 ml-4 text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <ChevronUp size={20} />
              </button>
            )}
          </div>

        {isExpanded && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 mt-2">
            {isStreakVulnerable && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300 font-medium">
                <div className="p-2 bg-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
                  <Zap size={14} className="fill-current" />
                </div>
                <div>
                  <span className="font-bold text-amber-700 dark:text-amber-300 block text-xs">Vulnerable Streak Protected</span>
                  <span className="text-[11px] text-amber-600/90 dark:text-amber-400/90">Your {streak}-day streak is protected by a Spark and is in a vulnerable state. Answer today's questions to rekindle your flame!</span>
                </div>
              </div>
            )}
            {hasEndedChallengeToday ? (
                <div className="flex flex-col gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsSummarizing(true); setIsExpanded(false); }}
                      className="w-full bg-orange-500 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
                    >
                      Review Summary
                    </button>
                </div>
            ) : (
                <>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Answer as many questions as you can in <span className="text-primary font-black">60 seconds</span>. 
                  Keep your streak alive by outperforming your mistakes!
                </p>

                <div className="p-3.5 bg-primary/5 dark:bg-primary/10 border border-primary/10 rounded-2xl space-y-1.5" id="lobby-tip-banner">
                  <p className="text-[9px] font-black text-primary uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={10} /> Daily Insight:
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 font-semibold leading-relaxed">
                    {lobbyTip}
                  </p>
                </div>
      
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleStart(); }}
                    className="w-full bg-primary text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all"
                  >
                    <Play size={14} fill="currentColor" />
                    {challengeHistory.length > 0 ? 'Continue Challenge' : 'Start Challenge'}
                  </button>
                </div>
                </>
            )}
            </motion.div>
        )}
      </motion.div>
    </div>
  );
};
