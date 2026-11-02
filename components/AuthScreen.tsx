
import React, { useState } from 'react';
import { Mail, Key, ArrowLeft, CheckCircle, AlertCircle, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { ICONS } from '../constants';
import { BackgroundBlobs } from './BackgroundBlobs';
import { TermsModal } from './TermsModal';
import { useIsDarkMode } from '../utils';

export const AuthScreen: React.FC<{ 
  onAuth: (email: string, p: string, isSignUp: boolean, username?: string, firstName?: string, lastName?: string) => Promise<string | null>; 
  onGoogleAuth: () => Promise<string | null>;
  onResetPassword: (email: string) => Promise<string | null>; 
}> = ({ onAuth, onGoogleAuth, onResetPassword }) => {
  const [isSignUp, setIsSignUp] = useState(false); 
  const [isResetting, setIsResetting] = useState(false); 
  const [email, setEmail] = useState(''); 
  const [username, setUsername] = useState(''); 
  const [firstName, setFirstName] = useState(''); 
  const [lastName, setLastName] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isDarkMode = useIsDarkMode();

  const handleSubmit = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (isLoading) return;
    setError(null); 
    setIsLoading(true);

    try {
      if (isResetting) { 
        const err = await onResetPassword(email); 
        if (!err) {
          setError("Password reset link sent to your email!");
          setIsResetting(false);
        } else {
          setError(err); 
        }
        return; 
      } 
      
      if (email.trim()) { 
        if (isSignUp) {
          if (!username.trim() || !firstName.trim() || !lastName.trim()) {
            setError("Username, First Name, and Last Name are required for sign up.");
            return;
          }
          if (!termsAccepted) {
            setError("You must agree to the Terms and Conditions to sign up.");
            return;
          }
        }
        const authError = await onAuth(email, password, isSignUp, isSignUp ? username.trim() : undefined, isSignUp ? firstName.trim() : undefined, isSignUp ? lastName.trim() : undefined); 
        if (authError) {
          if (authError.includes('Username taken') || authError.includes('Name taken')) {
            setError("THAT NAME IS ALREADY TAKEN. PLEASE CHOOSE ANOTHER.");
          } else {
            setError(authError);
          }
        }
      } 
    } finally {
      setIsLoading(false);
    }
  };

  const toggleReset = () => { setIsResetting(!isResetting); setError(null); setPassword(''); };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-start bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <BackgroundBlobs />

      <div className="w-full max-w-sm bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50 dark:border-gray-700 relative z-10 animate-fade-in my-auto">
        <div className="flex flex-col items-center justify-center mb-2 px-4">
          <img src={isDarkMode ? "/Graphics/LitterLookerTitleDark.png?v=2" : ICONS.TITLE} alt="LitterLooker" className="h-40 w-auto object-contain" />
        </div>
        
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">
            {isResetting ? "Password Reset" : isSignUp ? "Join the Mission" : "Welcome Back"}
          </h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            {isSignUp ? "Start Mending the Earth" : "Continue to Mend the Earth"}
          </p>
        </div>

        {error && (
          <div className={`px-4 py-3 rounded-xl text-xs font-black flex items-center gap-2 mb-6 animate-slide-up border uppercase tracking-wider leading-tight ${error.includes('sent') || error.includes('successfully') ? 'bg-green-50 border-green-200 text-green-600' : 'bg-red-50 border-red-200 text-red-600'}`}>
            {error.includes('sent') || error.includes('successfully') ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {error}
          </div>
        )}

        {isSignUp && !isResetting && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-3.5 mb-6 flex items-start gap-2.5 animate-fade-in text-left">
            <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-800 dark:text-amber-200 leading-relaxed font-bold">
              <span className="uppercase font-black block tracking-wider text-amber-700 dark:text-amber-300 mb-0.5">Real Identity Required</span>
              LitterLooker requires your <strong className="font-black text-amber-900 dark:text-amber-100">real full name</strong> and a <strong className="font-black text-amber-900 dark:text-amber-100">real photo of yourself</strong> for authentic community trust & accountability.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1 tracking-widest">Email Address</label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-gray-400"><Mail size={16} /></span>
              <input 
                type="email" 
                required
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-medium" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="mender@example.com" 
              />
            </div>
          </div>
          
          {isSignUp && !isResetting && (
            <div className="animate-slide-down space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1 tracking-widest">Username Handle</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-gray-400 font-bold"><User size={16} /></span>
                  <input 
                    type="text" 
                    required 
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-medium" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    placeholder="e.g. janedoe123"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1 tracking-widest">Real First Name</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-gray-400 font-bold"><User size={16} /></span>
                    <input 
                      type="text" 
                      required 
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-medium" 
                      value={firstName} 
                      onChange={(e) => setFirstName(e.target.value)} 
                      placeholder="e.g. Jane"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1 tracking-widest">Real Last Name</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-gray-400 font-bold"><User size={16} /></span>
                    <input 
                      type="text" 
                      required 
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-medium" 
                      value={lastName} 
                      onChange={(e) => setLastName(e.target.value)} 
                      placeholder="e.g. Doe"
                    />
                  </div>
                </div>
              </div>
              <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-1 ml-1">Must be your authentic first and last name.</p>
            </div>
          )}

          {!isResetting && (
            <div className="animate-slide-down">
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1 tracking-widest">Password</label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-gray-400"><Key size={16} /></span>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  className="w-full pl-11 pr-12 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-medium" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••" 
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {isSignUp && !isResetting && (
            <div className="flex items-start gap-2.5 pt-1 px-1">
              <input 
                type="checkbox"
                id="termsCheckbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
              />
              <label htmlFor="termsCheckbox" className="text-[10px] font-bold text-gray-500 dark:text-gray-400 cursor-pointer select-none leading-relaxed">
                I agree to the <button type="button" onClick={() => setShowTermsModal(true)} className="text-primary hover:underline font-black">Terms and Conditions</button> and acknowledge LitterLooker is not responsible for real-world activities.
              </label>
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 uppercase tracking-[0.15em] text-xs disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : (isResetting ? "Send Reset Link" : isSignUp ? "Begin My Journey" : "Log In")}
          </button>
        </form>

        {!isResetting && (
          <div className="mt-6 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-gray-700"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase font-black text-gray-400"><span className="bg-white dark:bg-gray-800 px-2">Or continue with</span></div>
            </div>
            
            <button 
              onClick={async () => {
                setIsLoading(true);
                const err = await onGoogleAuth();
                if (err) setError(err);
                setIsLoading(false);
              }}
              disabled={isLoading}
              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-black py-3.5 rounded-2xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px] disabled:opacity-50"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
              Sign in with Google
            </button>
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-4 border-t border-gray-100 dark:border-gray-700 pt-6">
          {!isResetting && !isSignUp && (
            <button onClick={toggleReset} className="text-[11px] text-gray-400 font-black uppercase tracking-widest hover:text-primary transition-colors" type="button">Forgot Password?</button>
          )}
          <button 
            onClick={() => { setIsSignUp(!isSignUp); setIsResetting(false); setError(null); setTermsAccepted(false); }} 
            className="text-[11px] text-primary font-black uppercase tracking-[0.2em] border-b-2 border-transparent hover:border-primary transition-all" 
            type="button"
          >
            {isSignUp ? "Already a member? Log in" : "New here? Join the Mission"}
          </button>
          {isResetting && (
            <button onClick={toggleReset} className="text-[11px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1.5" type="button">
              <ArrowLeft size={14} /> Back to Login
            </button>
          )}
        </div>
      </div>

      <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
    </div>
  );
};
