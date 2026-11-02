import React, { useState } from 'react';
import { Mail, RefreshCcw, LogOut, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { ICONS } from '../constants';
import { BackgroundBlobs } from './BackgroundBlobs';
import { useIsDarkMode } from '../utils';

interface EmailVerificationScreenProps {
  email: string;
  onResendEmail: () => Promise<string | null>;
  onCheckVerification: () => Promise<boolean>;
  onSignOut: () => Promise<void>;
  onShowNotification: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({
  email,
  onResendEmail,
  onCheckVerification,
  onSignOut,
  onShowNotification
}) => {
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const isDarkMode = useIsDarkMode();

  const handleResend = async () => {
    if (isResending || cooldown > 0) return;
    setIsResending(true);
    setStatusMessage(null);

    try {
      const err = await onResendEmail();
      if (err) {
        setStatusMessage({ text: err, type: 'error' });
      } else {
        setStatusMessage({ text: "Verification email resent! Please check your inbox and spam folder.", type: 'success' });
        setCooldown(30);
        const timer = setInterval(() => {
          setCooldown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (e: any) {
      setStatusMessage({ text: e.message || "Failed to resend verification email.", type: 'error' });
    } finally {
      setIsResending(false);
    }
  };

  const handleCheck = async () => {
    if (isChecking) return;
    setIsChecking(true);
    setStatusMessage(null);

    try {
      const isVerified = await onCheckVerification();
      if (!isVerified) {
        setStatusMessage({ text: "Email not verified yet. Click the link in your email and try again.", type: 'info' });
      }
    } catch (e: any) {
      setStatusMessage({ text: e.message || "Failed to check email verification status.", type: 'error' });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 relative overflow-hidden">
      <BackgroundBlobs />

      <div className="w-full max-w-md bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-2xl border border-white/50 dark:border-gray-700/80 relative z-10 animate-fade-in text-center my-auto">
        {/* Header Logo */}
        <div className="flex flex-col items-center justify-center mb-4">
          <img 
            src={isDarkMode ? "/Graphics/LitterLookerTitleDark.png?v=2" : ICONS.TITLE} 
            alt="LitterLooker" 
            className="h-28 sm:h-32 w-auto object-contain" 
          />
        </div>

        {/* Animated Mail Icon */}
        <div className="my-2 flex justify-center">
          <div className="p-4 bg-primary/10 rounded-full text-primary border border-primary/20 shadow-inner animate-pulse">
            <Mail size={36} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight mt-2">
          Verify Your Email
        </h2>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 mb-4">
          One Last Step Before You Begin
        </p>

        {/* Email Pill */}
        <div className="my-3 px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 font-bold text-xs flex items-center justify-center gap-2 break-all">
          <Mail size={16} className="text-primary shrink-0" />
          <span>{email || 'your email address'}</span>
        </div>

        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 leading-relaxed px-2">
          We sent a verification link to your email address. Please click the link inside to activate your account.
        </p>

        {/* Spam Reminder Box */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 flex items-start gap-3 text-left my-5 shadow-sm">
          <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Check Your Spam Folder
            </p>
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-200 mt-0.5 leading-snug">
              If you don't see the email in your inbox within a few minutes, please check your <strong>spam</strong> or <strong>junk mail</strong> folder.
            </p>
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`p-3.5 rounded-2xl text-xs font-black flex items-center gap-2 mb-5 animate-slide-down border text-left leading-tight ${
            statusMessage.type === 'success' 
              ? 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' 
              : statusMessage.type === 'info'
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleCheck}
            disabled={isChecking}
            className="w-full py-3.5 px-6 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            {isChecking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            <span>{isChecking ? 'Checking...' : 'Check for Updates'}</span>
          </button>

          <button
            onClick={handleResend}
            disabled={isResending || cooldown > 0}
            className="w-full py-3.5 px-6 rounded-2xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 font-black text-xs uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            {isResending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            <span>
              {isResending 
                ? 'Sending...' 
                : cooldown > 0 
                ? `Resend Email (${cooldown}s)` 
                : 'Resend Email'}
            </span>
          </button>

          <button
            onClick={onSignOut}
            className="pt-2 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 uppercase tracking-widest flex items-center justify-center gap-2 mx-auto transition-colors"
          >
            <LogOut size={14} />
            <span>Sign Out / Switch Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
