import React, { useState } from 'react';
import { Zap, MapPin as MapPinIcon, Trophy, Users, Medal, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { TabType } from '../types';

interface TutorialOverlayProps {
  onClose: (isFinished?: boolean) => void;
  onNavigate: (tab: TabType) => void;
  initialStep?: number;
  onStepChange?: (step: number) => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onClose, onNavigate, initialStep = 0, onStepChange }) => {
  const [step, setStep] = useState(initialStep);

  const handleStepChange = (newStep: number) => {
    setStep(newStep);
    if (onStepChange) onStepChange(newStep);
  };

  const steps = [
    {
      title: "Welcome Mender!",
      description: "Here's a quick guide to get you started on your mending journey.",
      icon: <Zap size={40} />,
      color: "text-primary",
      bg: "bg-primary/10",
      content: null
    },
    {
      title: "Map",
      description: "View surrounding pins and community events! Report cleaning progress or post a pin of your own.",
      icon: <MapPinIcon size={40} />,
      color: "text-white",
      bg: "bg-primary",
      content: "The map is your main tool. You can see where litter is reported, join group cleanups, and track your own progress."
    },
    {
      title: "Leaderboard",
      description: "Compete with surrounding members to earn rewards for cleaning the world!",
      icon: <Trophy size={40} />,
      color: "text-white",
      bg: "bg-green-800",
      content: "Check the leaderboard to see how you stack up against other Menders in your area. Top cleaners earn special badges and rewards."
    },
    {
      title: "Community",
      description: "Share your progress with the world! Comment and react to other Menders' work and connect with people of similar interests!",
      icon: <Users size={40} />,
      color: "text-white",
      bg: "bg-secondary",
      content: "Join Cleanup Crews, participate in discussions, and organize local events to make a bigger impact together."
    },
    {
      title: "Daily Question",
      description: "Answer the daily question to earn extra scrap and test your environmental knowledge!",
      icon: <Sparkles size={40} />,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      content: "Every day, a new question appears on your home screen. Correct answers give you a boost in scrap and XP!"
    },
    {
      title: "Achievements",
      description: "Complete goals to earn specific rewards and XP!",
      icon: <Medal size={40} />,
      color: "text-white",
      bg: "bg-orange-500",
      content: "Unlock achievements by completing specific tasks, like cleaning up 10 pins or organizing your first group cleanup."
    },
    {
      title: "XP and Ranks",
      description: "Level up to unlock special assets and purchase different things!",
      icon: <Zap size={40} />,
      color: "text-white",
      bg: "bg-green-500",
      content: "Earn XP for every action you take. Higher ranks unlock new features, like creating your own Cleanup Crew!"
    },
    {
      title: "Good luck Mending the Earth!",
      description: "You're all set to start your journey. Every bit of litter you pick up makes a difference.",
      icon: <Sparkles size={40} />,
      color: "text-white",
      bg: "bg-primary",
      content: "Remember, you can always revisit this tutorial from your profile settings if you need a refresher."
    }
  ];

  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 w-full max-w-md border dark:border-gray-700 shadow-2xl animate-pop-in space-y-6 flex flex-col min-h-[400px]">
        
        <div className="flex justify-between items-center mb-2">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-primary' : 'w-2 bg-gray-200 dark:bg-gray-700'}`} />
            ))}
          </div>
          <button onClick={() => onClose(true)} className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600">Skip</button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-fade-in" key={step}>
          <div className={`${currentStep.bg} w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-2 ${currentStep.color} shadow-inner`}>
            {currentStep.icon}
          </div>
          <h3 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">{currentStep.title}</h3>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest leading-relaxed px-4">
            {currentStep.description}
          </p>
          {currentStep.content && (
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300">
              {currentStep.content}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-auto pt-4">
          {step > 0 && (
            <button 
              onClick={() => handleStepChange(step - 1)}
              className="p-4 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <button 
            onClick={() => {
              if (step < steps.length - 1) handleStepChange(step + 1);
              else onClose(true);
            }}
            className="flex-1 bg-primary text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {step < steps.length - 1 ? (
              <>Next <ArrowRight size={16} /></>
            ) : (
              'Start Mending'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
