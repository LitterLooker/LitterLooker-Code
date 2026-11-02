
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Gift, Sparkles, Lock, Zap, Loader2, Check, ShoppingBag, Coins, X, Minus, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { UserProfile, ShopItem } from '../types';
import { db, OperationType, handleFirestoreError } from '../services/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { INFINITY_XP, INFINITY_SYMBOL } from '../utils';

export const RewardsPage: React.FC<{ 
  onBack: () => void;
  user: UserProfile;
  features: Record<string, string>;
  onUpdateUser: (u: UserProfile) => void;
}> = ({ onBack, user, features, onUpdateUser }) => {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);

  const isShopAvailable = features.shop !== 'disabled';
  const isInfinite = user.totalXP === INFINITY_XP;
  const currentScrap = isInfinite ? INFINITY_XP : (user.availableScrap || 0);

  useEffect(() => {
    if (!isShopAvailable) return;

    const q = query(collection(db, "shop"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShopItem)));
      setIsLoading(false);
    }, (err) => {
      setIsLoading(false);
      handleFirestoreError(err, OperationType.GET, "shop");
    });

    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [isShopAvailable]);

  const handlePurchase = async (item: ShopItem, qty: number = 1) => {
    const currentCount = user.purchaseCounts?.[item.id] || 0;
    if (item.maxPurchase !== undefined && currentCount >= item.maxPurchase) {
      alert("Purchase limit reached for this item");
      return;
    }

    const totalPrice = item.priceScrap * qty;
    if (!isInfinite && currentScrap < totalPrice) return;
    setIsPurchasing(item.id);
    try {
      const userRef = doc(db, "users", user.id);
      
      const updates: any = {
        availableScrap: isInfinite ? increment(0) : increment(-totalPrice),
        [`purchaseCounts.${item.id}`]: increment(qty),
      };

      if (item.type === 'spark') {
        updates.sparks = increment(qty);
      } else if (item.type === 'title') {
        updates.earnedTitles = arrayUnion(item.name);
        updates.unlockedAssets = arrayUnion(item.id);
      } else {
        updates.unlockedAssets = arrayUnion(item.id);
      }

      await updateDoc(userRef, updates);
      
      const immediateUpdates: any = { availableScrap: user.availableScrap - totalPrice };
      if (item.type === 'spark') immediateUpdates.sparks = (user.sparks || 0) + qty;
      else if (item.type === 'title') immediateUpdates.earnedTitles = [...(user.earnedTitles || []), item.name];
      else immediateUpdates.unlockedAssets = [...(user.unlockedAssets || []), item.id];
      
      const newPurchaseCounts = {
        ...(user.purchaseCounts || {}),
        [item.id]: (user.purchaseCounts?.[item.id] || 0) + qty
      };
      immediateUpdates.purchaseCounts = newPurchaseCounts;
      
      onUpdateUser({ ...user, ...immediateUpdates });
      
      setPurchaseSuccess(item.id);
      setTimeout(() => setPurchaseSuccess(null), 3000);
      if (selectedItem) setSelectedItem(null);
    } catch (e) {
      console.error("Purchase failed", e);
    } finally {
      setIsPurchasing(null);
      setQuantity(1);
    }
  };

  if (!isShopAvailable) {
    return (
      <div className="flex flex-col h-full bg-transparent animate-fade-in">
        <header className="bg-primary dark:bg-[#023020] px-4 py-4 flex items-center gap-3 shrink-0 shadow-lg">
          <button 
            onClick={onBack} 
            className="p-2 hover:bg-white/10 rounded-full transition text-white active:scale-90"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <h2 className="font-black text-lg text-white uppercase tracking-tight leading-none">Rewards</h2>
            <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-1">Redeem your Scrap</p>
          </div>
        </header>
        
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="relative mb-6">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-10 rounded-[3rem] border border-gray-100 dark:border-gray-700/50 backdrop-blur-sm">
              <Lock size={64} className="text-gray-300 dark:text-gray-600 animate-pulse" />
            </div>
          </div>
          
          <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-widest">Shop is closed</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold uppercase mt-4 max-w-[240px] leading-relaxed">
            The rewards catalog is currently disabled. Check back soon!
          </p>
          
          <button 
            onClick={onBack}
            className="mt-10 px-8 py-3 bg-primary/10 border border-primary/30 text-primary rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-primary hover:text-white"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0a0f18] animate-fade-in">
      <header className="bg-primary dark:bg-[#023020] px-4 py-4 flex items-center justify-between shrink-0 shadow-lg z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="p-2 hover:bg-white/10 rounded-full transition text-white active:scale-90"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <h2 className="font-black text-lg text-white uppercase tracking-tight leading-none">Scrap Shop</h2>
            <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-1">Redeem your hard work</p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-2xl flex items-center gap-2 border border-white/10">
          <Coins size={14} className="text-secondary" />
          <span className="text-xs font-black text-white">{isInfinite ? INFINITY_SYMBOL : currentScrap.toLocaleString()}</span>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar relative z-10 pb-8">
        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="text-primary animate-spin mb-4" size={32} />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Loading Goods...</p>
            </div>
          ) : items.filter(item => {
              const now = Date.now();
              if (item.disabled) return false;
              if (item.launchDate && now < item.launchDate) return false;
              if (item.endDate && now > item.endDate) return false;
              return true;
            }).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <ShoppingBag size={48} className="text-gray-200 dark:text-gray-800" />
              <div className="space-y-1">
                <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest">Shop is Empty</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Check back later for new arrivals</p>
              </div>
            </div>
          ) : (
            items.filter(item => {
              const now = Date.now();
              if (item.disabled) return false;
              if (item.launchDate && now < item.launchDate) return false;
              if (item.endDate && now > item.endDate) return false;
              return true;
            }).map(item => {
              const canAfford = isInfinite || currentScrap >= item.priceScrap;
              const purchaseCount = user.purchaseCounts?.[item.id] || 0;
              const isLimitReached = item.maxPurchase !== undefined && purchaseCount >= item.maxPurchase;
              const remaining = item.maxPurchase !== undefined ? (item.maxPurchase - purchaseCount) : null;
              const isOwned = (item.type === 'title' && (user.unlockedAssets?.includes(item.id) || user.earnedTitles?.includes(item.name))) || isLimitReached;
              const isProcessing = isPurchasing === item.id;
              const isSuccess = purchaseSuccess === item.id;

              return (
                <div 
                  key={item.id} 
                  onClick={() => {
                    setSelectedItem(item);
                    setQuantity(1);
                    setCurrentImageIdx(0);
                  }}
                  className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-5 shadow-xl border dark:border-gray-700 flex flex-col gap-4 group hover:scale-[1.02] transition-all cursor-pointer"
                >
                  <div className="flex gap-4">
                    <div className="w-24 h-24 rounded-3xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-800 overflow-hidden flex items-center justify-center relative shadow-inner">
                      {item.imageUrls?.[0] ? (
                        <img src={item.imageUrls[0]} className="w-full h-full object-cover" />
                      ) : (
                        <Gift className="text-gray-200 dark:text-gray-700" size={32} />
                      )}
                      <div className="absolute top-2 right-2 bg-white/90 dark:bg-black/50 backdrop-blur-sm p-1.5 rounded-xl shadow-sm">
                        <span className="text-[8px] font-black text-primary uppercase tracking-tighter">{item.type}</span>
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <h4 className={`font-black text-base leading-tight ${item.type === 'title' ? (item.rarity === 'Legendary' ? 'text-yellow-500' : item.rarity === 'Rare' ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500') : 'text-gray-800 dark:text-white'}`}>
                          {item.type === 'title' ? `« ${item.name} »` : item.name}
                        </h4>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium line-clamp-2 mt-1 leading-snug">{item.description}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-secondary/10 px-2 py-1 rounded-lg">
                          <Coins size={10} className="text-secondary" />
                          <span className="text-[10px] font-black text-secondary">{item.priceScrap.toLocaleString()}</span>
                        </div>
                        {remaining !== null && (
                          <span className="text-[10px] font-black text-gray-400 uppercase">
                            {remaining} Remaining
                          </span>
                        )}
                        {isOwned && item.type === 'title' && (
                          <div className="flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded-lg">
                            <Check size={10} className="text-green-500" />
                            <span className="text-[10px] font-black text-green-500">OWNED</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${
                      isOwned || isLimitReached
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-default' 
                        : isSuccess
                        ? 'bg-green-500 text-white'
                        : canAfford
                        ? 'bg-primary text-white group-hover:bg-primary/90 shadow-primary/20'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    }`}
                  >
                    {isProcessing ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : isSuccess ? (
                      <><Check size={18} /> Redeemed!</>
                    ) : isLimitReached ? (
                      'Limit Reached'
                    ) : isOwned ? (
                      'In Collection'
                    ) : (
                      'View Details'
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Item Details Modal */}
      {selectedItem && (() => {
        const purchaseCountModal = user.purchaseCounts?.[selectedItem.id] || 0;
        const isLimitReachedModal = selectedItem.maxPurchase !== undefined && purchaseCountModal >= selectedItem.maxPurchase;
        const isOwnedModal = (selectedItem.type === 'title' && (user.unlockedAssets?.includes(selectedItem.id) || user.earnedTitles?.includes(selectedItem.name))) || isLimitReachedModal;
        
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0a0f18]/80 backdrop-blur-md" onClick={() => setSelectedItem(null)} />
          <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-[3rem] overflow-hidden shadow-2xl animate-pop-in border border-white/10">
            <button 
              onClick={() => setSelectedItem(null)}
              className="absolute top-6 right-6 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all z-20"
            >
              <X size={20} />
            </button>

            <div className="h-64 relative bg-gray-50 dark:bg-gray-950 flex items-center justify-center border-b dark:border-gray-800">
              {selectedItem.imageUrls?.length ? (
                <>
                  <img src={selectedItem.imageUrls[currentImageIdx]} className="w-full h-full object-cover" />
                  {selectedItem.imageUrls.length > 1 && (
                    <>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIdx(prev => (prev === 0 ? selectedItem.imageUrls.length - 1 : prev - 1));
                        }}
                        className="absolute left-4 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIdx(prev => (prev === selectedItem.imageUrls.length - 1 ? 0 : prev + 1));
                        }}
                        className="absolute right-4 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full"
                      >
                        <ChevronRight size={20} />
                      </button>
                      <div className="absolute bottom-4 flex gap-1.5">
                        {selectedItem.imageUrls.map((_, i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === currentImageIdx ? 'bg-primary' : 'bg-white/50'}`} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <Gift size={64} className="text-gray-200 dark:text-gray-800" />
              )}
              <div className="absolute top-6 left-6 bg-primary px-3 py-1 rounded-xl shadow-lg">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">{selectedItem.type}</span>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black text-primary uppercase tracking-tighter bg-primary/10 px-2 py-1 rounded-md">{selectedItem.type}</span>
                </div>
                <h3 className={`text-2xl uppercase tracking-tight leading-none ${selectedItem.type === 'title' ? (selectedItem.rarity === 'Legendary' ? 'text-yellow-500 font-black' : selectedItem.rarity === 'Rare' ? 'text-blue-500 font-bold' : 'text-gray-400 dark:text-gray-500') : 'text-gray-800 dark:text-white font-black'}`}>
                  {selectedItem.type === 'title' ? `« ${selectedItem.name} »` : selectedItem.name}
                </h3>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 leading-relaxed">{selectedItem.description}</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border dark:border-gray-700">
                <div className="flex flex-col justify-center">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Price</span>
                  <div className="flex items-center gap-1">
                    <Coins size={14} className="text-secondary" />
                    <span className="text-base font-black text-gray-800 dark:text-white">{selectedItem.priceScrap.toLocaleString()}</span>
                  </div>
                </div>

                {selectedItem.type !== 'title' && selectedItem.type !== 'spark' && (!selectedItem.maxPurchase || selectedItem.maxPurchase > 1) ? (
                  <div className="flex flex-col items-end justify-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Quantity</span>
                    <div className="flex items-center gap-4 bg-white dark:bg-gray-900 px-3 py-2 rounded-2xl border dark:border-gray-700">
                      <button 
                        onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                        className="p-1 text-gray-400 hover:text-primary transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="text-sm font-black text-gray-800 dark:text-white min-w-[20px] text-center">{quantity}</span>
                      <button 
                        onClick={() => {
                          const maxPossible = selectedItem.maxPurchase ? selectedItem.maxPurchase - (user.purchaseCounts?.[selectedItem.id] || 0) : 99;
                          setQuantity(prev => Math.min(maxPossible, prev + 1));
                        }}
                        className="p-1 text-gray-400 hover:text-primary transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                ) : selectedItem.type === 'title' ? (
                  <div className="flex flex-col items-end justify-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Rarity</span>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
                      selectedItem.rarity === 'Legendary' ? 'bg-amber-500 text-white' :
                      selectedItem.rarity === 'Rare' ? 'bg-blue-500 text-white' :
                      'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}>{selectedItem.rarity || 'Common'}</span>
                  </div>
                ) : (
                  <div className="text-right flex flex-col justify-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Status</span>
                    <p className="text-xs font-black text-primary uppercase">
                      {isOwnedModal ? (isLimitReachedModal ? 'Limit Reached' : 'Already Owned') : 
                       (selectedItem.maxPurchase !== undefined ? `${selectedItem.maxPurchase - (user.purchaseCounts?.[selectedItem.id] || 0)} Remaining` : 'Available')}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Price</span>
                  <div className="flex items-center gap-1">
                    <Coins size={12} className="text-secondary" />
                    <span className={`text-sm font-black ${!isInfinite && currentScrap < selectedItem.priceScrap * quantity ? 'text-red-500' : 'text-gray-800 dark:text-white'}`}>
                      {(selectedItem.priceScrap * quantity).toLocaleString()} Scrap
                    </span>
                  </div>
                </div>

                <button
                  disabled={(!isInfinite && currentScrap < selectedItem.priceScrap * quantity) || isOwnedModal || !!isPurchasing}
                  onClick={() => handlePurchase(selectedItem, quantity)}
                  className={`w-full py-5 rounded-[2rem] text-sm font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${
                    isOwnedModal
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                      : (!isInfinite && currentScrap < selectedItem.priceScrap * quantity)
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-2 border-red-500/20'
                      : 'bg-primary text-white hover:scale-[1.02] active:scale-95 shadow-primary/30'
                  }`}
                >
                  {isPurchasing === selectedItem.id ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : isOwnedModal ? (
                    isLimitReachedModal ? 'Limit Reached' : 'In Collection'
                  ) : (!isInfinite && currentScrap < selectedItem.priceScrap * quantity) ? (
                    'Insufficient Scrap'
                  ) : (
                    `Redeem ${quantity > 1 ? quantity : ''} Reward${quantity > 1 ? 's' : ''}`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};
