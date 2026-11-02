import React, { useState, useEffect } from 'react';
import { MapPin, X, Search } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, getDocs } from 'firebase/firestore';

export const PinTagPicker: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelectPin: (pinId: string) => void;
}> = ({ isOpen, onClose, onSelectPin }) => {
  const [pins, setPins] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      const fetchPins = async () => {
        const querySnapshot = await getDocs(collection(db, "pins"));
        setPins(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      };
      fetchPins();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-sm bg-white dark:bg-[#111827] rounded-[2.5rem] shadow-2xl border-2 border-primary/20 dark:border-gray-800 overflow-hidden flex flex-col animate-pop-in max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl text-primary"><MapPin size={20} /></div>
            <div>
              <h3 className="font-black text-sm text-gray-800 dark:text-gray-100 uppercase tracking-widest">Select Pin</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 bg-white dark:bg-[#111827]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              autoFocus 
              className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-gray-100 transition-all shadow-inner font-bold" 
              placeholder="Search pins..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y dark:divide-gray-800 hide-scrollbar bg-white dark:bg-[#111827]">
          {pins.filter(p => p.status !== 'cleaned' && (p.description || '').toLowerCase().includes(search.toLowerCase())).map(pin => (
            <button 
              key={pin.id} 
              onClick={() => { onSelectPin(pin.id); onClose(); }}
              className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            >
              <MapPin size={20} className="text-primary" />
              <p className="text-xs font-black text-gray-900 dark:text-white truncate">{pin.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
