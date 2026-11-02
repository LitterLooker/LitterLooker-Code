import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const NotificationToast: React.FC<{ message: string; type: 'success' | 'error' | 'warning' | 'info'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, []);
  const config = { 
    success: { bg: 'bg-green-500', icon: <CheckCircle size={20} /> }, 
    error: { bg: 'bg-red-500', icon: <AlertCircle size={20} /> }, 
    warning: { bg: 'bg-amber-500', icon: <AlertTriangle size={20} /> },
    info: { bg: 'bg-blue-500', icon: <Info size={20} /> }
  };
  return (
    <div className={`fixed top-4 left-4 right-4 z-[9999] p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in transform transition-all duration-300 text-white ${config[type].bg}`}>
      <div className="p-1 bg-white/20 rounded-full">{config[type].icon}</div>
      <p className="flex-1 text-sm font-bold">{message}</p>
      <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full" type="button"><X size={16} /></button>
    </div>
  );
};