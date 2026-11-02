import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Share2, Download, Trophy, MapPin, Trash2, Calendar, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';
import { getRankInfo } from '../utils';
import { ICONS } from '../constants';
import { motion } from 'motion/react';
import html2canvas from 'html2canvas';

interface ImpactCardProps {
  user: UserProfile;
  onClose: () => void;
}

export const ImpactCard: React.FC<ImpactCardProps> = ({ user, onClose }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const rankInfo = getRankInfo(user.totalXP);

  const handleDownload = async () => {
    if (cardRef.current) {
      const canvas = await html2canvas(cardRef.current, { 
        backgroundColor: null,
        scale: 2,
        useCORS: true
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `LitterLooker_Impact_${user.username}.png`;
      a.click();
    }
  };

  const handleShare = async () => {
    if (cardRef.current) {
      const canvas = await html2canvas(cardRef.current, { 
        backgroundColor: null,
        scale: 2,
        useCORS: true
      });
      canvas.toBlob(async (blob) => {
        if (blob && navigator.share) {
          try {
            const file = new File([blob], `LitterLooker_Impact_${user.username}.png`, { type: 'image/png' });
            await navigator.share({
              title: 'My LitterLooker Impact',
              text: `I've collected ${(user.litterStats?.piecesCount || 0)} pieces of litter and cleared ${(user.litterStats?.areaSqM || 0).toFixed(1)}m²! Join me on LitterLooker!`,
              files: [file],
            });
          } catch (err: any) {
            if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
              console.log('Share cancelled by user');
            } else {
              console.error('Error sharing:', err);
              handleDownload();
            }
          }
        } else {
          handleDownload();
        }
      });
    }
  };

  const content = (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-900 rounded-[3rem] overflow-hidden shadow-2xl border dark:border-gray-800 relative"
          ref={cardRef}
        >
          {/* Header Background */}
          <div className="h-32 bg-primary relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            </div>
            <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -top-12 -left-12 w-40 h-40 bg-secondary/20 rounded-full blur-3xl" />
            
            <div className="absolute top-6 left-6 flex items-center" style={{ gap: '8px' }}>
              <img 
                src={ICONS.LOGO} 
                alt="LitterLooker" 
                crossOrigin="anonymous"
                style={{ width: '32px', height: '32px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} 
              />
              <span className="text-white font-black uppercase tracking-widest text-xs" style={{ lineHeight: '32px' }}>LitterLooker</span>
            </div>
          </div>

          {/* Profile Section */}
          <div className="px-8 pb-8 -mt-12 relative z-10">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-900 bg-gray-100 dark:bg-gray-800 overflow-hidden shadow-xl">
                {user.profilePicture ? (
                  <img src={user.profilePicture} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Trash2 size={40} />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">@{user.username}</h2>
                <div className="flex items-center justify-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest">
                  <Trophy size={12} />
                  <span>{rankInfo.name}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full mt-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-3xl border dark:border-gray-700">
                  <div className="flex items-center gap-2 text-emerald-500 mb-1">
                    <Trash2 size={14} />
                    <span className="text-[8px] font-black uppercase tracking-widest">Pieces</span>
                  </div>
                  <p className="text-xl font-black text-gray-900 dark:text-white">{user.litterStats?.piecesCount || 0}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-3xl border dark:border-gray-700">
                  <div className="flex items-center gap-2 text-indigo-500 mb-1">
                    <MapPin size={14} />
                    <span className="text-[8px] font-black uppercase tracking-widest">Area</span>
                  </div>
                  <p className="text-xl font-black text-gray-900 dark:text-white">{(user.litterStats?.areaSqM || 0).toFixed(1)}m²</p>
                </div>
              </div>

              <div className="w-full bg-primary/5 dark:bg-primary/10 p-4 rounded-3xl border border-primary/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary text-white p-2 rounded-xl">
                    <Calendar size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Mending Since</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{new Date(user.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total XP</p>
                  <p className="text-xs font-black text-primary">{(user.totalXP || 0).toLocaleString()}</p>
                </div>
              </div>


            </div>
          </div>
        </motion.div>

        <div className="flex gap-3">
          <button 
            onClick={handleShare}
            className="flex-1 bg-primary text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Share2 size={16} /> Share Impact
          </button>
          <button 
            onClick={handleDownload}
            className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white font-black px-6 py-4 rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center border dark:border-gray-700"
          >
            <Download size={16} />
          </button>
        </div>

        <button 
          onClick={onClose}
          className="text-white/40 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
