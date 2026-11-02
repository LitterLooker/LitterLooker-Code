
import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isOpen?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  isDestructive = true,
  isOpen = true
  }) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  if (!isOpen) return null;
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[100000] flex items-center justify-center p-6 animate-fade-in backdrop-blur-sm bg-black/60"
      onClick={onCancel}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 shadow-2xl w-full max-w-sm border dark:border-gray-700 animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className={`p-4 rounded-full ${isDestructive ? 'bg-red-50 text-red-500' : 'bg-primary/10 text-primary'}`}>
            <AlertTriangle size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">{title}</h3>
            <p className="text-sm font-bold text-gray-500 leading-relaxed">{message}</p>
          </div>
          <div className="flex flex-col w-full gap-2 mt-4">
            <button 
              onClick={onConfirm}
              className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 ${isDestructive ? 'bg-red-500 text-white' : 'bg-primary text-white'}`}
            >
              {confirmText}
            </button>
            <button 
              onClick={onCancel}
              className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes pop-in {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop-in {
          animation: pop-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </div>,
    document.body
  );
};
