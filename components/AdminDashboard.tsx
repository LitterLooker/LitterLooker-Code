import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Shield, ShieldAlert, Megaphone, Lock, Unlock, Camera, Send, Loader2, Pin, MessageSquare, Heart, Eye, ArrowLeft, Trash2, RefreshCcw, Database, Clock, Search, History, AlertCircle, X, Map, Plus, Zap, Crosshair, MapPin, Calendar, Sparkles, BrainCircuit, Layers, Check, Edit3, Image as ImageIcon, Link as LinkIcon, Tag, BarChart3 } from 'lucide-react';
import { Announcement, UserProfile, MapPin as PinType, AdminLog, MultiplierZone, GlobalSettings, ContentReport, CommunityPost, ShopItem } from '../types';
import { db, OperationType, handleFirestoreError } from '../services/firebase';
import { collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, limit, addDoc, deleteDoc, getDocs, where, getDoc, writeBatch, arrayUnion, increment } from 'firebase/firestore';
import { sanitizeData, formatFullTimestamp, getMultiplierColor, convertWeight, convertArea, getWeightUnit, getAreaUnit, migrateUserDatabaseStructure } from '../utils';
import { UserTagPicker } from './UserTagPicker';
import { findLitterHotspots } from '../services/gemini';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

const ActivityChart: React.FC<{
  pins: PinType[];
  users: UserProfile[];
  posts: any[];
  cleanups: any[];
}> = ({ pins, users, posts, cleanups }) => {
  const data = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d);
    }

    return days.map(day => {
      const dayStart = new Date(day.setHours(0, 0, 0, 0)).getTime();
      const dayEnd = new Date(day.setHours(23, 59, 59, 999)).getTime();
      
      const dayPins = pins.filter(p => p.timestamp >= dayStart && p.timestamp <= dayEnd).length;
      const dayUsers = users.filter(u => u.joinedAt >= dayStart && u.joinedAt <= dayEnd).length;
      const dayPosts = posts.filter(p => p.timestamp >= dayStart && p.timestamp <= dayEnd).length;
      const dayCleanups = cleanups.filter(c => c.timestamp >= dayStart && c.timestamp <= dayEnd).length;
      const dayCleared = pins.filter(p => p.status === 'cleaned' && p.timestamp >= dayStart && p.timestamp <= dayEnd).length; // Approximation as we don't track clearedAt explicitly in types yet

      return {
        name: day.toLocaleDateString('en-US', { weekday: 'short' }),
        Pins: dayPins,
        Users: dayUsers,
        Posts: dayPosts,
        Cleanups: dayCleanups,
        Cleared: dayCleared
      };
    });
  }, [pins, users, posts, cleanups]);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border dark:border-gray-700 shadow-xl space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-blue-500/10 p-2.5 rounded-2xl text-blue-600"><BarChart3 size={20} /></div>
        <h3 className="font-black text-sm uppercase tracking-widest text-gray-800 dark:text-white">7-Day Activity Trends</h3>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorPins" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{fontSize: 10, fontWeight: 700, fill: '#9CA3AF'}} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{fontSize: 10, fontWeight: 700, fill: '#9CA3AF'}} 
            />
            <Tooltip 
              contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '12px', fontWeight: 'bold'}}
              cursor={{stroke: '#9CA3AF', strokeWidth: 1, strokeDasharray: '4 4'}}
            />
            <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '10px'}} />
            <Area type="monotone" dataKey="Pins" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorPins)" />
            <Area type="monotone" dataKey="Users" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
            <Area type="monotone" dataKey="Posts" stroke="#F59E0B" strokeWidth={2} fill="transparent" strokeDasharray="5 5" />
            <Area type="monotone" dataKey="Cleanups" stroke="#8B5CF6" strokeWidth={2} fill="transparent" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const AdminDashboard: React.FC<{
  user: UserProfile;
  announcement: Announcement | null;
  isLockedDown: boolean;
  pins: PinType[];
  allUsers: Record<string, UserProfile>;
  onBack: () => void;
  onShowNotification: (msg: string, type: 'success' | 'error' | 'warning') => void;
  zones: MultiplierZone[];
  lockdownReason?: string;
  groupCleanups: any[];
  posts: any[];
  features: Record<string, string>;
  globalSettings: GlobalSettings | null;
  isAdminPanelValid: boolean;
  isModPanelValid?: boolean;
  isModeratorOnly?: boolean;
}> = ({ user, announcement, isLockedDown, pins, allUsers, onBack, onShowNotification, zones, lockdownReason, groupCleanups, posts, features, globalSettings, isAdminPanelValid, isModPanelValid, isModeratorOnly }) => {
  const [activeTab, setActiveTab] = useState<'broadcast' | 'multiplier' | 'logs' | 'moderation' | 'shop'>(isModeratorOnly ? 'moderation' : 'broadcast');
  const [content, setContent] = useState(announcement?.content || '');
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [shopItemName, setShopItemName] = useState('');
  const [shopItemPrice, setShopItemPrice] = useState(100);
  const [shopItemDescription, setShopItemDescription] = useState('');
  const [shopItemType, setShopItemType] = useState<ShopItem['type']>('product');
  const [shopItemDisabled, setShopItemDisabled] = useState(false);
  const [shopItemMaxPurchase, setShopItemMaxPurchase] = useState<number | undefined>(undefined);
  const [shopItemLaunchDate, setShopItemLaunchDate] = useState<string>('');
  const [shopItemEndDate, setShopItemEndDate] = useState<string>('');
  const [shopItemRarity, setShopItemRarity] = useState<ShopItem['rarity']>('Common');
  const [shopItemImages, setShopItemImages] = useState<string[]>([]);
  const [viewingReport, setViewingReport] = useState<ContentReport | null>(null);
  const [isResolving, setIsResolving] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(announcement?.imageUrl || announcement?.image || null);
  const [linkedPinId, setLinkedPinId] = useState(announcement?.linkedPinId || '');
  const [allowComments, setAllowComments] = useState(announcement?.allowComments !== false);
  const [allowReactions, setAllowReactions] = useState(announcement?.allowReactions !== false);
  const [offerFreeSpark, setOfferFreeSpark] = useState(announcement?.offerFreeSpark || false);
  const [taggedUsernames, setTaggedUsernames] = useState<string[]>(announcement?.taggedUsernames || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPinSelector, setShowPinSelector] = useState(false);
  const [pinSearch, setPinSearch] = useState('');
  const [isShopAuthenticated, setIsShopAuthenticated] = useState(false);
  const [shopAuthKey, setShopAuthKey] = useState('');
  const [isVerifyingShop, setIsVerifyingShop] = useState(false);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [isVerifyingAccess, setIsVerifyingAccess] = useState(true);
  const [lockdownReasonInput, setLockdownReasonInput] = useState(lockdownReason || '');
  const [showLockdownConfirm, setShowLockdownConfirm] = useState(false);
  
  // Zone Creator States
  const [isCreatingZone, setIsCreatingZone] = useState(false);
  const [newZoneTitle, setNewZoneTitle] = useState('');
  const [newZoneRadius, setNewZoneRadius] = useState(200);
  const [newZoneMultiplier, setNewZoneMultiplier] = useState(2);
  const [newZoneLocation, setNewZoneLocation] = useState<{lat: number, lng: number} | null>(null);
  const [newZoneAddress, setNewZoneAddress] = useState<string>('');
  const [newZoneDescription, setNewZoneDescription] = useState<string>('');
  const [newZoneStartTime, setNewZoneStartTime] = useState<string>('');
  const [newZoneEndTime, setNewZoneEndTime] = useState<string>('');
  const [addressSearch, setAddressSearch] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  
  // Zone Editing States
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState<string>('');
  const [editEndTime, setEditEndTime] = useState<string>('');
  
  // Bulk Building States
  const [bulkTitle, setBulkTitle] = useState('Weekly Environmental Blitz');
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkStartTime, setBulkStartTime] = useState('');
  const [bulkEndTime, setBulkEndTime] = useState('');
  const [isBulkDeploying, setIsBulkDeploying] = useState(false);
  const [bulkSuggestions, setBulkSuggestions] = useState<any[]>([]);
  const [isScanningHotspots, setIsScanningHotspots] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AdminLog | null>(null);
  const [isMigratingDb, setIsMigratingDb] = useState(false);
  const [isUpdatingLeaderboard, setIsUpdatingLeaderboard] = useState(false);

  const handleRunMigration = async () => {
    setIsMigratingDb(true);
    try {
      const res = await migrateUserDatabaseStructure(db);
      if (res.success) {
        await addLog("Database Migration", `Updated ${res.count} user documents to organized structure`);
        onShowNotification(`Successfully migrated ${res.count} user documents!`, "success");
      } else {
        onShowNotification("Database migration encountered an error.", "error");
      }
    } catch (e) {
      onShowNotification("Database migration failed.", "error");
    } finally {
      setIsMigratingDb(false);
    }
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Removed Google Maps refs

  // Sync Logs
  useEffect(() => {
    if (!user.isAdmin) {
      const timer = setTimeout(() => setIsVerifyingAccess(false), 1500);
      return () => clearTimeout(timer);
    }

    const logsRef = collection(db, "admin_logs");
    const q = query(logsRef, orderBy("timestamp", "desc"), limit(50));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const logsArr = snap.docs.map(doc => ({ ...doc.data() as AdminLog, id: doc.id }));
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      setLogs(logsArr.filter(log => log.timestamp > thirtyDaysAgo));
      setIsVerifyingAccess(false);
    }, (error) => {
      console.warn("Log sync permission delayed:", error.message);
      handleFirestoreError(error, OperationType.GET, "admin_logs");
      setIsVerifyingAccess(false);
    });
    
    return unsubscribe;
  }, [user.isAdmin]);

  // Handle map creation - Leaflet components used directly in render
  const MapController = ({ center, zoom }: { center: { lat: number, lng: number } | null, zoom?: number }) => {
    const map = useMap();
    useEffect(() => {
      if (center) {
        map.flyTo(center, zoom || map.getZoom());
      }
    }, [center, zoom, map]);
    return null;
  };

  const MapClickHandler = ({ onClick }: { onClick: (lat: number, lng: number) => void }) => {
    useMapEvents({
      click: (e) => onClick(e.latlng.lat, e.latlng.lng),
    });
    return null;
  };

  const liveAdminZones = useMemo(() => {
    const now = Date.now();
    return zones.filter(z => !z.endTime || now < z.endTime);
  }, [zones]);

  useEffect(() => {
    const q = query(collection(db, "moderation"), orderBy("timestamp", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentReport));
      setReports(reportsData);
    }, (err) => handleFirestoreError(err, OperationType.GET, "moderation"));
    return () => unsubscribe();
  }, []);

  const isPanelValid = activeTab === 'moderation' ? isModPanelValid : isAdminPanelValid;

  useEffect(() => {
    const q = query(collection(db, "shop"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setShopItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShopItem)));
    }, (err) => handleFirestoreError(err, OperationType.GET, "shop"));
    return () => unsubscribe();
  }, [activeTab]);

  const handleSaveShopItem = async () => {
    if (!shopItemName || shopItemPrice < 0) {
      onShowNotification("Name and valid price required", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const itemId = editingItem?.id || `item_${Date.now()}`;

      if (shopItemType === 'spark' && !shopItemDisabled) {
        const activeSparks = shopItems.filter(item => item.type === 'spark' && !item.disabled && item.id !== itemId);
        if (activeSparks.length > 0) {
          onShowNotification("There can only be one active spark item.", "error");
          setIsSubmitting(false);
          return;
        }
      }

      const itemData: Omit<ShopItem, 'id'> = {
        name: shopItemName,
        description: shopItemDescription,
        priceScrap: shopItemPrice,
        imageUrls: shopItemType === 'title' ? [] : shopItemImages,
        type: shopItemType,
        maxPurchase: shopItemType === 'title' ? 1 : shopItemMaxPurchase,
        launchDate: shopItemLaunchDate ? new Date(shopItemLaunchDate).getTime() : undefined,
        endDate: shopItemEndDate ? new Date(shopItemEndDate).getTime() : undefined,
        rarity: shopItemType === 'title' ? shopItemRarity : undefined,
        disabled: shopItemDisabled,
        createdAt: editingItem?.createdAt || Date.now()
      };
      await setDoc(doc(db, "shop", itemId), sanitizeData(itemData));
      await addLog(editingItem ? "Edit Shop Item" : "Add Shop Item", `${shopItemName} - ${shopItemPrice} Scrap`);
      onShowNotification(`Item ${editingItem ? 'updated' : 'added'} success!`, "success");
      resetShopForm();
    } catch (e) {
      onShowNotification("Failed to save item.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetShopForm = () => {
    setIsAddingItem(false);
    setEditingItem(null);
    setShopItemName('');
    setShopItemPrice(100);
    setShopItemDescription('');
    setShopItemType('product');
    setShopItemDisabled(false);
    setShopItemImages([]);
    setShopItemMaxPurchase(undefined);
    setShopItemLaunchDate('');
    setShopItemEndDate('');
    setShopItemRarity('Common');
  };

  const handleDeleteShopItem = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, "shop", itemToDelete));
      await addLog("Delete Shop Item", `ID: ${itemToDelete}`);
      onShowNotification("Item removed.", "success");
      setItemToDelete(null);
    } catch (e) {
      onShowNotification("Delete failed.", "error");
    }
  };

  const verifyShopKey = async () => {
    if (!shopAuthKey) return;
    setIsVerifyingShop(true);
    try {
      const snap = await getDoc(doc(db, "meta", "security"));
      if (snap.exists()) {
        const data = snap.data();
        if (data.shopKey === shopAuthKey) {
          setIsShopAuthenticated(true);
          onShowNotification("Shop Access Granted", "success");
        } else {
          onShowNotification("Invalid Shop Key", "error");
        }
      }
    } catch (e) {
      onShowNotification("Access Denied", "error");
    } finally {
      setIsVerifyingShop(false);
    }
  };

  const handleResolveReport = async (reportId: string, action: 'resolve' | 'delete') => {
    if (!isPanelValid) {
      onShowNotification(`${isModeratorOnly ? 'Moderator' : 'Admin'} panel is currently inactive. Actions disabled.`, "error");
      return;
    }
    setIsResolving(reportId);
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) return;

      if (action === 'delete') {
        if (report.targetType === 'user') {
          const userRef = doc(db, 'users', report.targetId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const currentWarnings = userData.warnings || 0;
            await updateDoc(userRef, { warnings: currentWarnings + 1 });
            await addLog(`Moderation: Warn User`, `Warned user ${report.targetId} due to user report ${reportId}`);
          }
        } else {
          const collectionName = report.targetType === 'pin' ? 'pins' : 'posts';
          const targetDocRef = doc(db, collectionName, report.targetId);
          const targetDocSnap = await getDoc(targetDocRef);
          
          if (targetDocSnap.exists()) {
            const targetData = targetDocSnap.data();
            const targetUserId = targetData.userId || targetData.authorId;
            
            if (targetUserId) {
              const userRef = doc(db, "users", targetUserId);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const userData = userSnap.data();
                const currentWarnings = userData.warnings || 0;
                await updateDoc(userRef, { warnings: currentWarnings + 1 });
                await addLog(`Moderation: Warn User`, `Warned user ${targetUserId} due to deleted ${report.targetType} from report ${reportId}`);
              }
            }
          }

          await deleteDoc(targetDocRef);
          await addLog(`Moderation: Delete ${report.targetType}`, `Deleted ${report.targetType} ${report.targetId} due to report ${reportId}`);
        }

        // Reward the reporter for a valid report
        if (report.reporterId) {
          const reporterRef = doc(db, "users", report.reporterId);
          const reporterSnap = await getDoc(reporterRef);
          if (reporterSnap.exists()) {
            const reporterData = reporterSnap.data();
            await updateDoc(reporterRef, {
              credibilityScore: (reporterData.credibilityScore || 0) + 1,
              notifications: arrayUnion({
                id: `report_accepted_${Date.now()}`,
                type: 'system',
                title: 'Report Accepted',
                message: 'Your report was reviewed and action was taken. Your credibility score has increased!',
                timestamp: Date.now(),
                read: false
              })
            });
          }
        }
      }

      await updateDoc(doc(db, "moderation", reportId), { status: 'resolved', resolvedAt: Date.now() });
      onShowNotification(`Report ${action === 'delete' ? 'resolved and action taken' : 'resolved'}.`, "success");
    } catch (e) {
      console.error("Error resolving report:", e);
      onShowNotification("Failed to resolve report.", "error");
    } finally {
      setIsResolving(null);
    }
  };

  const addLog = async (action: string, details: string) => {
    if (!isPanelValid) return;
    try {
      await addDoc(collection(db, "admin_logs"), sanitizeData({
        id: '', adminId: user.id, adminUsername: user.username, action, details, timestamp: Date.now()
      }));
    } catch (e) {}
  };

  const handleAddressSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressSearch.trim() || isSearchingAddress) return;
    setIsSearchingAddress(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressSearch)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const newCoords = { lat: parseFloat(lat), lng: parseFloat(lon) };
        setNewZoneLocation(newCoords); 
        setNewZoneAddress(display_name); 
        setIsCreatingZone(true);
      }
    } catch (err) {} finally { setIsSearchingAddress(false); }
  };

  const handleClearInteractions = async () => {
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "meta", "announcement"), { reactions: {}, replies: [] });
      onShowNotification("Cleared interactions.", "success");
      setShowClearConfirm(false);
    } catch (e) {
      onShowNotification("Failed to clear.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePurgeZones = async () => {
    if (!isAdminPanelValid) {
      onShowNotification("Admin panel is currently inactive.", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      zones.forEach(z => {
        batch.delete(doc(db, "zones", z.id));
      });
      await batch.commit();
      await addLog("System Purge", "All multiplier zones deleted by admin.");
      onShowNotification("All zones purged.", "success");
      setShowPurgeConfirm(false);
    } catch (e) {
      onShowNotification("Purge failed.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateZone = async () => {
    if (!isAdminPanelValid) {
      onShowNotification("Admin panel is currently inactive.", "error");
      return;
    }
    if (!newZoneLocation) return;

    const startMs = newZoneStartTime ? new Date(newZoneStartTime).getTime() : undefined;
    const endMs = newZoneEndTime ? new Date(newZoneEndTime).getTime() : undefined;

    if (startMs && endMs && endMs <= startMs) {
      onShowNotification("End time must be after start time", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // Use sanitized address as doc ID
      const zoneId = newZoneAddress.replace(/\//g, '-');
      await setDoc(doc(db, "zones", zoneId), sanitizeData({
        id: zoneId, lat: newZoneLocation.lat, lng: newZoneLocation.lng, radius: newZoneRadius, multiplier: newZoneMultiplier,
        title: newZoneTitle || undefined,
        address: newZoneAddress, timestamp: Date.now(), description: newZoneDescription || undefined,
        startTime: startMs,
        endTime: endMs
      }));
      await addLog("Created Zone", `${newZoneMultiplier}x multiplier at ${newZoneAddress}`);
      onShowNotification("Zone created.", "success");
      setIsCreatingZone(false); setNewZoneLocation(null); setNewZoneTitle('');
    } catch (error) { onShowNotification("Save failed.", "error"); } finally { setIsSubmitting(false); }
  };

  const handleDeleteZone = async (id: string) => {
    if (!isAdminPanelValid) {
      onShowNotification("Admin panel is currently inactive.", "error");
      return;
    }
    try {
      await deleteDoc(doc(db, "zones", id));
      await addLog("Deleted Zone", `ID: ${id}`);
      onShowNotification("Removed.", "success");
    } catch (error) {}
  };

  const handleStartZoneEdit = (zone: MultiplierZone) => {
    setEditingZoneId(zone.id);
    setEditStartTime(zone.startTime ? new Date(zone.startTime).toISOString().slice(0, 16) : '');
    setEditEndTime(zone.endTime ? new Date(zone.endTime).toISOString().slice(0, 16) : '');
  };

  const handleSaveZoneSchedule = async (id: string) => {
    if (!isAdminPanelValid) {
      onShowNotification("Admin panel is currently inactive.", "error");
      return;
    }
    const start = editStartTime ? new Date(editStartTime).getTime() : null;
    const end = editEndTime ? new Date(editEndTime).getTime() : null;

    if (start && end && end <= start) {
      onShowNotification("End time must be after start time", "error");
      return;
    }

    setIsSyncing(true);
    try {
      const updates: any = {
        startTime: start,
        endTime: end
      };
      await updateDoc(doc(db, "zones", id), sanitizeData(updates));
      await addLog("Updated Zone Schedule", `ID: ${id}`);
      onShowNotification("Schedule updated.", "success");
      setEditingZoneId(null);
    } catch (e) {
      onShowNotification("Failed to update.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleScanHotspots = async () => {
    if (!newZoneLocation) {
      onShowNotification("Select a map center first", "warning");
      return;
    }
    setIsScanningHotspots(true);
    try {
      const hotspots = await findLitterHotspots(newZoneLocation.lat, newZoneLocation.lng, Number.isNaN(bulkCount) ? 5 : bulkCount, pins);
      setBulkSuggestions(hotspots);
      onShowNotification(`Found ${hotspots.length} hotspots!`, "success");
    } catch (e) {
      onShowNotification("AI Scan failed.", "error");
    } finally {
      setIsScanningHotspots(false);
    }
  };

  const handleDeployBulkZones = async () => {
    if (!isAdminPanelValid) {
      onShowNotification("Admin panel is currently inactive.", "error");
      return;
    }
    if (bulkSuggestions.length === 0) return;
    setIsBulkDeploying(true);
    try {
      const batch = writeBatch(db);
      const startMs = bulkStartTime ? new Date(bulkStartTime).getTime() : undefined;
      const endMs = bulkEndTime ? new Date(bulkEndTime).getTime() : undefined;

      bulkSuggestions.forEach(s => {
        const zoneId = `AI_${s.name.replace(/\s+/g, '_')}_${Date.now()}`;
        const zoneData = sanitizeData({
          id: zoneId,
          lat: s.lat,
          lng: s.lng,
          radius: s.radius,
          multiplier: s.multiplier,
          title: s.name,
          address: s.reason,
          timestamp: Date.now(),
          description: `AI-Suggested Hotspot: ${s.reason}`,
          startTime: startMs,
          endTime: endMs
        });
        batch.set(doc(db, "zones", zoneId), zoneData);
      });

      await batch.commit();
      await addLog("Bulk AI Deployment", `Deployed ${bulkSuggestions.length} AI-suggested zones.`);
      onShowNotification(`Deployed ${bulkSuggestions.length} zones!`, "success");
      setBulkSuggestions([]);
    } catch (e) {
      onShowNotification("Bulk deployment failed.", "error");
    } finally {
      setIsBulkDeploying(false);
    }
  };

  const handleUpdateAnnouncement = async () => {
    if (!isAdminPanelValid) {
      onShowNotification("Admin panel is currently inactive.", "error");
      return;
    }
    if (!content.trim()) return;
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, "meta", "announcement"), sanitizeData({
        id: 'announcement', 
        content: content.trim(), 
        timestamp: Date.now(), 
        imageUrl: image || undefined,
        linkedPinId: linkedPinId || undefined, 
        allowComments, 
        allowReactions, 
        offerFreeSpark,
        sparkClaimers: offerFreeSpark && !announcement?.offerFreeSpark ? [] : (announcement?.sparkClaimers || []),
        reactions: announcement?.reactions || {}, 
        replies: announcement?.replies || [],
        taggedUsernames: taggedUsernames.length > 0 ? taggedUsernames : undefined
      }));
      await addLog("Broadcast", content);
      onShowNotification("Broadcast live!", "success");
    } catch (error) {} finally { setIsSubmitting(false); }
  };

  const handleToggleLockdown = async () => {
    if (!isAdminPanelValid) {
      onShowNotification("Admin panel is currently inactive.", "error");
      return;
    }
    try {
      await updateDoc(doc(db, "meta", "security"), { 
        isLockedDown: !isLockedDown,
        lockdownReason: !isLockedDown ? lockdownReasonInput : ''
      });
      await addLog(isLockedDown ? "Unlocked" : "Locked", `System status changed. Reason: ${!isLockedDown ? lockdownReasonInput : 'N/A'}`);
      setShowLockdownConfirm(false);
    } catch (error) {}
  };

  if (isVerifyingAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-transparent p-12 text-center space-y-6">
        <Loader2 size={48} className="text-primary animate-spin" />
        <h3 className="text-sm font-black text-white uppercase tracking-widest">Accessing Satellite...</h3>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-transparent animate-fade-in">
      <div className="p-4 bg-red-600 text-white shadow-lg flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition"><ArrowLeft size={20} /></button>
          <div className="flex flex-col">
            <h2 className="font-black text-lg uppercase tracking-tight">{isModeratorOnly ? 'Moderator' : 'Admin'}</h2>
            <p className="text-[8px] font-bold text-white/70 uppercase tracking-widest mt-1">{isModeratorOnly ? 'Moderator Access' : 'Restricted Access'}</p>
          </div>
        </div>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`px-3 py-1 rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-white/30 transition-all ${isPanelValid ? 'bg-white/20' : 'bg-black/40'}`}
        >
          <Shield size={12} />
          <span className="text-[10px] font-black uppercase text-white">{isPanelValid ? 'active' : 'inactive'}</span>
        </button>
      </div>

      <div className="flex border-b dark:border-gray-800 shrink-0 bg-white dark:bg-[#0a0f18]">
        {!isModeratorOnly && (
          <>
            <button onClick={() => setActiveTab('broadcast')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest ${activeTab === 'broadcast' ? 'border-b-4 border-red-600 text-red-600' : 'text-gray-400'}`}>Global</button>
            <button onClick={() => setActiveTab('multiplier')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest ${activeTab === 'multiplier' ? 'border-b-4 border-red-600 text-red-600' : 'text-gray-400'}`}>Multipliers</button>
          </>
        )}
        <button onClick={() => setActiveTab('moderation')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest ${activeTab === 'moderation' ? 'border-b-4 border-red-600 text-red-600' : 'text-gray-400'}`}>Moderation</button>
        {!isModeratorOnly && (
          <button onClick={() => setActiveTab('shop')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest ${activeTab === 'shop' ? 'border-b-4 border-red-600 text-red-600' : 'text-gray-400'}`}>Shop</button>
        )}
      </div>

      {activeTab === 'shop' && (features?.shop === 'disabled' || features?.shop === 'admin') && (
        <div className={`py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white text-center shrink-0 border-b border-white/10 ${features.shop === 'disabled' ? 'bg-orange-500' : 'bg-amber-500'}`}>
          {features.shop === 'disabled' ? 'Shop is disabled' : 'Shop is admin-only'}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-16 hide-scrollbar">
        {activeTab === 'broadcast' && (
          <>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border dark:border-gray-700 shadow-xl">
              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Menders</p>
                  <p className="text-2xl font-black text-gray-800 dark:text-white">{Object.keys(allUsers).length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pins</p>
                  <p className="text-2xl font-black text-gray-800 dark:text-white">{pins.length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Scheduled Cleanups</p>
                  <p className="text-2xl font-black text-gray-800 dark:text-white">{groupCleanups.filter(c => !c.isCompleted).length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Global Posts</p>
                  <p className="text-2xl font-black text-gray-800 dark:text-white">{posts.length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Leaderboard Sets</p>
                  <p className="text-2xl font-black text-gray-800 dark:text-white">
                    {new Set((Object.values(allUsers) as UserProfile[]).map(u => u.leaderboardId).filter(Boolean)).size}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Active Zones</p>
                  <p className="text-2xl font-black text-gray-800 dark:text-white">
                    {zones.filter(z => {
                      const now = Date.now();
                      const isTimeActive = (!z.startTime || now >= z.startTime) && (!z.endTime || now <= z.endTime);
                      return isTimeActive;
                    }).length}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Completed Cleanups</p>
                  <p className="text-2xl font-black text-gray-800 dark:text-white">{groupCleanups.filter(c => c.isCompleted).length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Weight</p>
                  <p className="text-2xl font-black text-gray-800 dark:text-white">{convertWeight(globalSettings?.totalLitterStats?.weightKg || 0, user.measurementSystem).toFixed(1)}{getWeightUnit(user.measurementSystem)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Area</p>
                  <p className="text-2xl font-black text-gray-800 dark:text-white">{convertArea(globalSettings?.totalLitterStats?.areaSqM || 0, user.measurementSystem).toFixed(1)}{getAreaUnit(user.measurementSystem)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Pieces</p>
                  <p className="text-2xl font-black text-gray-800 dark:text-white">{globalSettings?.totalLitterStats?.piecesCount || 0}</p>
                </div>
              </div>
            </div>

            <ActivityChart 
              pins={pins} 
              users={Object.values(allUsers) as UserProfile[]} 
              posts={posts} 
              cleanups={groupCleanups} 
            />

            {/* System Updates Block */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-xl space-y-6">
              {/* User Database Structure Update */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 shrink-0">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase text-gray-800 dark:text-white">User Database Structure Update</h3>
                    <p className="text-[10px] font-bold text-gray-400 mt-0.5">Format all user documents in database with the new format</p>
                  </div>
                </div>
                <button
                  onClick={handleRunMigration}
                  disabled={isMigratingDb}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-black text-[10px] uppercase tracking-widest shadow-md flex items-center gap-2 disabled:opacity-50 transition-all shrink-0"
                >
                  {isMigratingDb ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                  <span>{isMigratingDb ? 'Migrating...' : 'Run Update'}</span>
                </button>
              </div>

              {/* Leaderboard Update */}
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-primary/10 text-primary shrink-0">
                    <RefreshCcw size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase text-gray-800 dark:text-white">Leaderboard Update</h3>
                    <p className="text-[10px] font-bold text-gray-400 mt-0.5">Manually trigger a global leaderboard recalculation and update all shards.</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setIsUpdatingLeaderboard(true);
                    try {
                      const { processGlobalLeaderboards } = await import('../services/dailyTaskService');
                      await processGlobalLeaderboards(true);
                      onShowNotification("Global Rankings updated successfully.", "success");
                    } catch (e) {
                      onShowNotification("Failed to update Global Rankings.", "error");
                    } finally {
                      setIsUpdatingLeaderboard(false);
                    }
                  }}
                  disabled={isUpdatingLeaderboard}
                  className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 active:scale-98 text-white font-black text-[10px] uppercase tracking-widest shadow-md flex items-center gap-2 disabled:opacity-50 transition-all shrink-0"
                >
                  {isUpdatingLeaderboard ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                  <span>{isUpdatingLeaderboard ? 'Updating...' : 'Run Update'}</span>
                </button>
              </div>
            </div>

            <div className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col gap-4 ${isLockedDown ? 'bg-red-50 border-red-500' : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${isLockedDown ? 'bg-red-500 text-white' : 'bg-green-100 text-green-600'}`}>{isLockedDown ? <Lock size={20} /> : <Unlock size={20} />}</div>
                  <h3 className="font-black text-sm uppercase text-gray-800 dark:text-white">App Lock</h3>
                </div>
                <button 
                  onClick={() => isLockedDown ? handleToggleLockdown() : setShowLockdownConfirm(true)} 
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg ${isLockedDown ? 'bg-white text-red-600' : 'bg-red-600 text-white'}`}
                >
                  {isLockedDown ? "Unlock" : "Lock"}
                </button>
              </div>
              
              {!isLockedDown && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Lockdown Reason (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Scheduled Maintenance" 
                    value={lockdownReasonInput} 
                    onChange={e => setLockdownReasonInput(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>
              )}
              
              {isLockedDown && lockdownReason && (
                <div className="p-3 bg-red-100/50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-900/50">
                  <p className="text-[8px] font-black text-red-600 uppercase tracking-widest mb-1">Active Reason</p>
                  <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{lockdownReason.replace(/^["'“”‘’]|["'“”‘’]$/g, '').trim()}</p>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
                <h3 className="font-black text-sm uppercase tracking-widest text-gray-800 dark:text-white pt-4">Feature Toggles</h3>
                {[
                  { key: 'ai', label: 'AI Features' },
                  { key: 'pins', label: 'Map Pins' },
                  { key: 'community', label: 'Community Posts' },
                  { key: 'scheduling', label: 'Cleanup Scheduling' },
                  { key: 'daily', label: 'Daily Challenges' },
                  { key: 'crews', label: 'Cleanup Crews' },
                  { key: 'shop', label: 'Rewards Shop' },
                  { key: 'leaderboard', label: 'Global Rankings' }
                ].map((feature) => (
                  <div key={feature.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl">
                    <span className="text-xs font-black uppercase text-gray-800 dark:text-white">{feature.label}</span>
                    <button 
                      onClick={async () => {
                        if (!isAdminPanelValid) {
                          onShowNotification("Admin panel is currently inactive.", "error");
                          return;
                        }
                        const modes = ['disabled', 'admin', 'enabled'];
                        const currentMode = features[feature.key] === 'enabled' ? 'enabled' : 
                                           features[feature.key] === 'admin' ? 'admin' : 'disabled';
                        const currentIndex = Array.isArray(modes) ? modes.indexOf(currentMode) : -1;
                        const nextMode = modes[(currentIndex + 1) % modes.length];
                        try {
                          await updateDoc(doc(db, "meta", "security"), { features: { ...features, [feature.key]: nextMode } });
                          onShowNotification(`${feature.label} set to ${nextMode.toUpperCase()}.`, 'success');
                        } catch (e) {
                          onShowNotification(`Failed to toggle ${feature.label}.`, 'error');
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg ${
                        features[feature.key] === 'disabled' ? 'bg-red-600 text-white' : 
                        features[feature.key] === 'admin' ? 'bg-amber-600 text-white' : 'bg-green-600 text-white'
                      }`}
                    >
                      {features[feature.key] || 'Disabled'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 shadow-xl border dark:border-gray-700 space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-secondary p-2.5 rounded-2xl text-green-800"><Megaphone size={20} /></div>
                <h3 className="font-black text-sm uppercase tracking-widest text-gray-800 dark:text-white">Global Broadcast</h3>
              </div>
              <div className="space-y-4">
                <textarea className="w-full bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-2xl p-4 text-sm font-medium outline-none h-32 resize-none" placeholder="Announcement content..." value={content} onChange={e => setContent(e.target.value)} />
                
                {showPinSelector && (
                  <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-primary/20 space-y-3 animate-slide-up">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Select Community Pin</span>
                      {linkedPinId && (
                        <button onClick={() => setLinkedPinId('')} className="text-[9px] font-black text-red-500 uppercase tracking-widest">Clear</button>
                      )}
                    </div>
                    <div className="relative mb-2">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input className="w-full pl-8 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-[10px] outline-none" placeholder="Search pins or users..." value={pinSearch} onChange={e => setPinSearch(e.target.value)} />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                      {pins.filter(p => p.description.toLowerCase().includes(pinSearch.toLowerCase()) || p.username.toLowerCase().includes(pinSearch.toLowerCase())).length === 0 ? (
                        <p className="text-[10px] text-gray-400 italic py-2">No matching pins found.</p>
                      ) : (
                        pins.filter(p => p.description.toLowerCase().includes(pinSearch.toLowerCase()) || p.username.toLowerCase().includes(pinSearch.toLowerCase())).map(p => (
                          <button key={p.id} onClick={() => { setLinkedPinId(p.id); setShowPinSelector(false); }} className={`shrink-0 w-32 p-3 rounded-xl border-2 transition-all text-left ${linkedPinId === p.id ? 'border-primary bg-primary/5' : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'}`}>
                            <p className="text-[10px] font-black text-gray-800 dark:text-gray-100 truncate mb-0.5">{p.description}</p>
                            <p className="text-[8px] text-primary font-black uppercase tracking-tighter truncate mb-1">@{p.username}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                      <div className="relative">
                        <button 
                          onClick={() => fileInputRef.current?.click()} 
                          className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${!!image ? 'bg-primary border-primary text-white hover:bg-primary/90' : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`} 
                          type="button" 
                          title="Attach Image"
                        >
                          <ImageIcon size={20} />
                        </button>
                        {image && (
                          <button onClick={() => setImage(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:scale-110 transition-transform"><X size={10} /></button>
                        )}
                      </div>
                      <input type="file" ref={fileInputRef} onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onloadend = () => setImage(r.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
                      <button 
                        onClick={() => setShowPinSelector(!showPinSelector)} 
                        className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${!!linkedPinId || showPinSelector ? 'bg-primary border-primary text-white hover:bg-primary/90' : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`} 
                        type="button" 
                        title="Link Pin"
                      >
                        <LinkIcon size={20} />
                      </button>
                      <UserTagPicker 
                        allUsers={allUsers} 
                        currentUser={user} 
                        selectedUsernames={taggedUsernames} 
                        onToggleUser={u => setTaggedUsernames(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u])} 
                        variant="icon" 
                        buddyIds={user.friends} 
                        onClose={() => {}} 
                        triggerIcon={<Tag size={20} />}
                        triggerClassName={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer shrink-0 ${taggedUsernames.length > 0 ? 'bg-primary border-primary text-white hover:bg-primary/90' : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                      />
                      <button 
                        onClick={() => setAllowComments(!allowComments)} 
                        className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${allowComments ? 'bg-primary border-primary text-white hover:bg-primary/90' : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`} 
                        type="button" 
                        title="Toggle Comments"
                      >
                        <MessageSquare size={20} />
                      </button>
                      <button 
                        onClick={() => setAllowReactions(!allowReactions)} 
                        className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${allowReactions ? 'bg-primary border-primary text-white hover:bg-primary/90' : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`} 
                        type="button" 
                        title="Toggle Reactions"
                      >
                        <Heart size={20} />
                      </button>
                      <button 
                        onClick={() => setOfferFreeSpark(!offerFreeSpark)} 
                        className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${offerFreeSpark ? 'bg-primary border-primary text-white hover:bg-primary/90' : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`} 
                        type="button" 
                        title="Offer Free Spark"
                      >
                        <Zap size={20} />
                      </button>
                      <button 
                        onClick={async () => {
                          if (!isAdminPanelValid) {
                            onShowNotification("Admin panel is currently inactive.", "error");
                            return;
                          }
                          if (!globalSettings) return;
                          try {
                            await updateDoc(doc(db, "meta", "globalSettings"), { showPublicStats: !globalSettings.showPublicStats });
                            onShowNotification(`Community Impact ${!globalSettings.showPublicStats ? 'enabled' : 'disabled'}.`, 'success');
                          } catch (e) {
                            onShowNotification("Failed to update toggle.", "error");
                          }
                        }}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${globalSettings?.showPublicStats ? 'bg-primary border-primary text-white hover:bg-primary/90' : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                        type="button"
                        title="Toggle Community Impact"
                      >
                        <BarChart3 size={20} />
                      </button>
                    </div>

                <div className="flex items-center gap-2 mt-4">
                  <button onClick={handleUpdateAnnouncement} disabled={isSubmitting} className="flex-1 bg-primary text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 uppercase text-xs">
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Send Alert</>}
                  </button>
                  <button 
                    onClick={() => {
                      if (!isAdminPanelValid) {
                        onShowNotification("Admin panel is currently inactive.", "error");
                        return;
                      }
                      setShowClearConfirm(true);
                    }}
                    disabled={isSubmitting}
                    className="w-14 bg-red-500/10 text-red-500 font-black py-4 rounded-2xl shadow-sm flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                    title="Clear Interactions"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'multiplier' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 shadow-xl border dark:border-gray-700 space-y-6">
              <h3 className="font-black text-sm uppercase tracking-widest text-gray-800 dark:text-white">Zone Management</h3>
              <form onSubmit={handleAddressSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="w-full pl-10 pr-4 py-2.5 rounded-xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold outline-none" placeholder="Search address..." value={addressSearch} onChange={e => setAddressSearch(e.target.value)} />
                </div>
                <button type="submit" className="bg-primary text-white px-4 rounded-xl shadow-lg"><Search size={16} /></button>
              </form>
              <div className="w-full h-72 rounded-3xl overflow-hidden border-2 dark:border-gray-700 relative z-0">
                <MapContainer center={[37.7749, -122.4194]} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false}>
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  />
                  <MapController center={newZoneLocation} zoom={16} />
                  <MapClickHandler onClick={async (lat, lng) => {
                    setNewZoneLocation({ lat, lng });
                    setIsCreatingZone(true);
                    setIsReverseGeocoding(true);
                    try {
                      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                      const data = await res.json();
                      setNewZoneAddress(data.display_name || 'Unknown Location');
                    } catch (err) {
                      setNewZoneAddress('Address fetch failed');
                    } finally {
                      setIsReverseGeocoding(false);
                    }
                  }} />
                  
                  {zones.filter(z => !z.endTime || Date.now() < z.endTime).map(z => (
                    <Circle
                      key={z.id}
                      center={[z.lat, z.lng]}
                      radius={z.radius}
                      pathOptions={{
                        color: getMultiplierColor(z.multiplier),
                        fillColor: getMultiplierColor(z.multiplier),
                        fillOpacity: 0.2
                      }}
                    />
                  ))}

                  {newZoneLocation && (
                    <Circle
                      center={[newZoneLocation.lat, newZoneLocation.lng]}
                      radius={newZoneRadius}
                      pathOptions={{
                        color: getMultiplierColor(newZoneMultiplier),
                        fillColor: getMultiplierColor(newZoneMultiplier),
                        fillOpacity: 0.4
                      }}
                    />
                  )}
                </MapContainer>
                <button onClick={() => { if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => { setNewZoneLocation({ lat: p.coords.latitude, lng: p.coords.longitude }); }); }} className="absolute bottom-4 left-4 z-[400] bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xl border dark:border-gray-700 text-primary"><Crosshair size={24} /></button>
              </div>
              {isCreatingZone && (
                <div className="p-5 bg-gray-50 dark:bg-gray-900 rounded-3xl border-2 border-primary space-y-4 animate-slide-up">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-400 ml-1">Zone Title (Optional)</label>
                    <input className="w-full p-3 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 text-[10px] font-bold outline-none dark:text-white" placeholder="e.g. Waterfront Cleanup" value={newZoneTitle} onChange={e => setNewZoneTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-400 ml-1">Zone Address</label>
                    <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 text-[10px] font-bold text-gray-600 dark:text-gray-300">{isReverseGeocoding ? 'Fetching...' : newZoneAddress}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black uppercase text-gray-400 ml-1">Radius: {newZoneRadius}m</label>
                      <input type="range" min="50" max="1000" step="50" value={newZoneRadius} onChange={e => setNewZoneRadius(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none accent-primary" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-gray-400 ml-1">Multiplier: {newZoneMultiplier}x</label>
                      <input type="range" min="2" max="10" step="1" value={newZoneMultiplier} onChange={e => setNewZoneMultiplier(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none accent-primary" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <label className="text-[9px] font-black uppercase text-gray-400">Start (Opt)</label>
                      <input type="datetime-local" className="w-full p-2 text-[10px] rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={newZoneStartTime} onChange={e => setNewZoneStartTime(e.target.value)} />
                    </div>
                    <div className="min-w-0">
                      <label className="text-[9px] font-black uppercase text-gray-400">End (Opt)</label>
                      <input type="datetime-local" className="w-full p-2 text-[10px] rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white" value={newZoneEndTime} min={newZoneStartTime} onChange={e => setNewZoneEndTime(e.target.value)} />
                    </div>
                  </div>
                  <button onClick={handleCreateZone} disabled={isSubmitting} className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Establish Zone</button>
                </div>
              )}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Active Zones</h4>
                  <button onClick={() => setShowPurgeConfirm(true)} className="text-[9px] font-black uppercase text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">Purge All</button>
                </div>
                {liveAdminZones.map(z => {
                  const isEditing = editingZoneId === z.id;
                  return (
                    <div key={z.id} className="bg-white dark:bg-gray-800 p-4 rounded-[1.5rem] border dark:border-gray-700 flex flex-col gap-4 shadow-sm animate-fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded-xl" style={{ color: getMultiplierColor(z.multiplier) }}><Zap size={18} /></div>
                          <div>
                            <p className="text-xs font-black dark:text-white">{z.title || 'Untitled Zone'} ({z.multiplier}x)</p>
                            <p className="text-[9px] text-gray-400 truncate max-w-[150px]">{z.address}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => isEditing ? setEditingZoneId(null) : handleStartZoneEdit(z)} className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-red-50 text-red-600' : 'text-gray-300 hover:text-primary'}`}>{isEditing ? <X size={16}/> : <Clock size={16}/>}</button>
                          <button onClick={() => handleDeleteZone(z.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                        </div>
                      </div>
                      
                      {isEditing && (
                        <div className="pt-3 border-t dark:border-gray-700 space-y-3 animate-slide-up">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1 min-w-0">
                              <label className="text-[8px] font-black uppercase text-gray-400 ml-1">Edit Start</label>
                              <input type="datetime-local" className="w-full p-2 text-[9px] rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} />
                            </div>
                            <div className="space-y-1 min-w-0">
                              <label className="text-[8px] font-black uppercase text-gray-400 ml-1">Edit End</label>
                              <input type="datetime-local" className="w-full p-2 text-[9px] rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white" value={editEndTime} min={editStartTime} onChange={e => setEditEndTime(e.target.value)} />
                            </div>
                          </div>
                          <button onClick={() => handleSaveZoneSchedule(z.id)} disabled={isSyncing} className="w-full py-2 bg-primary text-white rounded-xl font-black uppercase text-[10px] shadow-md flex items-center justify-center gap-2">
                            {isSyncing ? <Loader2 className="animate-spin" size={14}/> : <><Check size={14}/> Save Changes</>}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'moderation' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 shadow-xl border dark:border-gray-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-red-500/10 p-2.5 rounded-2xl text-red-600"><ShieldAlert size={20} /></div>
                <h3 className="font-black text-sm uppercase tracking-widest text-gray-800 dark:text-white">Content Reports</h3>
              </div>
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto hide-scrollbar">
                {reports.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="bg-gray-100 dark:bg-gray-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-gray-400">
                      <Check size={32} />
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No pending reports</p>
                  </div>
                ) : (
                  reports.map(report => (
                    <div key={report.id} className={`p-5 rounded-3xl border-2 transition-all ${report.status === 'resolved' ? 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 opacity-60' : 'bg-white dark:bg-gray-800 border-red-100 dark:border-red-900/30 shadow-sm'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${report.targetType === 'pin' ? 'bg-green-100 text-green-600' : report.targetType === 'user' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                            {report.targetType}
                          </span>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${report.status === 'resolved' ? 'bg-gray-200 text-gray-500' : 'bg-red-100 text-red-600'}`}>
                            {report.status}
                          </span>
                        </div>
                        <span className="text-[8px] font-black text-gray-400 uppercase">{formatFullTimestamp(report.timestamp)}</span>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reason</p>
                        <p className="text-xs font-bold text-gray-800 dark:text-white leading-relaxed">{report.reason}</p>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl">
                          <p className="uppercase text-[7px] font-black opacity-50 mb-0.5">Reporter ID</p>
                          <p className="text-[10px] break-all font-mono">{report.reporterId}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl">
                          <p className="uppercase text-[7px] font-black opacity-50 mb-0.5">Target ID</p>
                          <p className="text-[10px] break-all font-mono">{report.targetId}</p>
                        </div>
                      </div>
                      <button onClick={() => setViewingReport(report)} className="text-[10px] font-black text-primary uppercase tracking-widest mb-4">View Content</button>

                      {report.status === 'pending' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleResolveReport(report.id, 'resolve')}
                            disabled={!!isResolving}
                            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-gray-200 transition-colors disabled:opacity-50"
                          >
                            {isResolving === report.id ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Dismiss'}
                          </button>
                          <button 
                            onClick={() => handleResolveReport(report.id, 'delete')}
                            disabled={!!isResolving}
                            className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg shadow-red-600/20 hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            {isResolving === report.id ? <Loader2 size={14} className="animate-spin mx-auto" /> : (report.targetType === 'user' ? 'Warn User' : 'Delete Content')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              {viewingReport && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-lg w-full">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold">Reported Content ({viewingReport.targetType})</h3>
                      <button onClick={() => setViewingReport(null)}><X /></button>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-2xl mb-4">
                      {viewingReport.targetType === 'post' ? (
                        posts.find(p => p.id === viewingReport.targetId) ? (
                          <p>{posts.find(p => p.id === viewingReport.targetId)?.content}</p>
                        ) : (
                          <p>Post not found.</p>
                        )
                      ) : viewingReport.targetType === 'pin' ? (
                        pins.find(p => p.id === viewingReport.targetId) ? (
                          <p>{pins.find(p => p.id === viewingReport.targetId)?.description}</p>
                        ) : (
                          <p>Pin not found.</p>
                        )
                      ) : viewingReport.targetType === 'user' ? (
                        (() => {
                          const user = (Object.values(allUsers) as UserProfile[]).find(u => u.id === viewingReport.targetId);
                          return user ? (
                            <div>
                              <p className="font-bold">Username: {user.username}</p>
                              <p className="text-sm mt-2">Description: {user.description || 'No description'}</p>
                            </div>
                          ) : (
                            <p>User not found.</p>
                          );
                        })()
                      ) : (
                        <p>Unknown report type.</p>
                      )}
                    </div>
                    <button onClick={() => setViewingReport(null)} className="w-full py-3 bg-primary text-white rounded-full font-bold">Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'shop' && (
          <div className="space-y-6">
            {!isShopAuthenticated ? (
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 shadow-xl border dark:border-gray-700 flex flex-col items-center text-center space-y-6 animate-slide-up">
                <div className="w-20 h-20 bg-orange-50 dark:bg-orange-900/20 rounded-full flex items-center justify-center text-orange-500">
                  <Lock size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Shop Authentication</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">Enter today's 4-digit Shop Key to manage the scrap marketplace.</p>
                </div>
                <div className="w-full max-w-xs space-y-4">
                  <input 
                    type="text"
                    maxLength={4}
                    placeholder="0 0 0 0"
                    value={shopAuthKey}
                    onChange={e => setShopAuthKey(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-5 rounded-3xl bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-primary outline-none text-center text-2xl font-black tracking-[0.5em] text-gray-800 dark:text-white"
                  />
                  <button 
                    onClick={verifyShopKey}
                    disabled={shopAuthKey.length !== 4 || isVerifyingShop}
                    className="w-full py-4 rounded-2xl bg-primary text-white font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                  >
                    {isVerifyingShop ? <Loader2 className="animate-spin" size={20} /> : <Unlock size={20} />}
                    Unlock Shop
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {!isAddingItem && !editingItem ? (
                  <>
                    <button 
                      onClick={() => setIsAddingItem(true)}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Add New Item
                </button>

                <div className="grid grid-cols-1 gap-4">
                  {shopItems.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-[2.5rem] border dark:border-gray-700">
                      <Tag size={48} className="mx-auto text-gray-300 mb-4" />
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No items in shop</p>
                    </div>
                  ) : (
                    shopItems.map(item => (
                      <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-[2rem] border dark:border-gray-700 flex items-center justify-between shadow-sm animate-fade-in group">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-900 overflow-hidden flex items-center justify-center border dark:border-gray-800">
                            {item.imageUrls?.[0] ? (
                              <img src={item.imageUrls[0]} className="w-full h-full object-cover" />
                            ) : (
                              <Sparkles className="text-gray-300" size={24} />
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <h4 className={`font-black text-sm text-gray-800 dark:text-white truncate flex items-center gap-2 ${ (item.disabled || (item.endDate && Date.now() > item.endDate)) ? 'text-gray-400' : ''}`}>
                              {item.name}
                              {(item.disabled || (item.endDate && Date.now() > item.endDate)) && <span className="text-[8px] font-black uppercase text-red-500 bg-red-100 px-1.5 py-0.5 rounded-md">Inactive</span>}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-primary uppercase tracking-tighter">{item.priceScrap} Scrap</span>
                              <span className="w-1 h-1 bg-gray-200 rounded-full" />
                              <span className="text-[8px] font-black uppercase text-white bg-primary px-1.5 py-0.5 rounded-md tracking-widest">{item.type}</span>
                              {item.type === 'title' && item.rarity && (
                                <>
                                  <span className="w-1 h-1 bg-gray-200 rounded-full" />
                                  <span className={`text-[8px] font-black uppercase text-white px-1.5 py-0.5 rounded-md tracking-widest ${
                                    item.rarity === 'Legendary' ? 'bg-amber-500' :
                                    item.rarity === 'Rare' ? 'bg-blue-500' :
                                    'bg-gray-400'
                                  }`}>{item.rarity}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setEditingItem(item);
                              setShopItemName(item.name);
                              setShopItemPrice(item.priceScrap);
                              setShopItemDescription(item.description);
                              setShopItemType(item.type);
                              setShopItemImages(item.imageUrls || []);
                              setShopItemMaxPurchase(item.maxPurchase);
                              setShopItemRarity(item.rarity || 'Common');
                              setShopItemDisabled(!!item.disabled);
                              setShopItemLaunchDate(item.launchDate ? new Date(item.launchDate).toISOString().slice(0, 16) : '');
                              setShopItemEndDate(item.endDate ? new Date(item.endDate).toISOString().slice(0, 16) : '');
                            }}
                            className="p-2 text-gray-400 hover:text-primary transition-colors bg-gray-50 dark:bg-gray-900 rounded-xl"
                          >
                            <Edit3 size={18} />
                          </button>
                          <button 
                            onClick={() => setItemToDelete(item.id)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors bg-red-50 dark:bg-red-900/20 rounded-xl"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 shadow-xl border dark:border-gray-700 space-y-6 animate-slide-up">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm uppercase tracking-widest text-gray-800 dark:text-white">
                    {editingItem ? 'Edit Item' : 'New Item'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button onClick={resetShopForm} className="text-gray-400 hover:text-red-500"><X /></button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-400 ml-1">Item Name</label>
                    <input className="w-full p-4 rounded-2xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold outline-none" placeholder="e.g. Trash Grabber" value={shopItemName} onChange={e => setShopItemName(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-gray-400 ml-1">Price (Scrap)</label>
                      <input type="number" className="w-full p-4 rounded-2xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold outline-none" value={shopItemPrice} onChange={e => setShopItemPrice(parseInt(e.target.value, 10))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-gray-400 ml-1">Type</label>
                      <select 
                        className="w-full p-4 rounded-2xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold outline-none"
                        value={shopItemType}
                        onChange={e => {
                          const val = e.target.value as any;
                          setShopItemType(val);
                          if (val === 'title' || val === 'spark') setShopItemMaxPurchase(1);
                        }}
                      >
                        <option value="spark">Spark</option>
                        <option value="title">Title</option>
                        <option value="product">Product</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                       <input type="checkbox" checked={shopItemDisabled} onChange={e => setShopItemDisabled(e.target.checked)} className="w-4 h-4 rounded" />
                       <label className="text-[9px] font-black uppercase text-gray-400">Disabled</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {shopItemType !== 'title' && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-400 ml-1">Max Per User</label>
                        <input 
                          type="number" 
                          className="w-full p-4 rounded-2xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold outline-none" 
                          placeholder="Unlimited"
                          value={shopItemMaxPurchase || ''} 
                          onChange={e => setShopItemMaxPurchase(e.target.value ? parseInt(e.target.value, 10) : undefined)} 
                        />
                      </div>
                    )}
                    {shopItemType === 'title' && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-400 ml-1">Rarity</label>
                        <select 
                          className="w-full p-4 rounded-2xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold outline-none"
                          value={shopItemRarity}
                          onChange={e => setShopItemRarity(e.target.value as any)}
                        >
                          <option value="Common">Common</option>
                          <option value="Rare">Rare</option>
                          <option value="Legendary">Legendary</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-gray-400 ml-1">Launch Date</label>
                      <input 
                        type="datetime-local" 
                        className="w-full p-4 rounded-2xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold outline-none" 
                        value={shopItemLaunchDate} 
                        onChange={e => setShopItemLaunchDate(e.target.value)} 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-gray-400 ml-1">End Date</label>
                      <input 
                        type="datetime-local" 
                        className="w-full p-4 rounded-2xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold outline-none" 
                        value={shopItemEndDate} 
                        onChange={e => setShopItemEndDate(e.target.value)} 
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-400 ml-1">Description</label>
                    <textarea 
                      className="w-full p-4 rounded-2xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-bold outline-none h-24 resize-none"
                      placeholder="What does this item do?"
                      value={shopItemDescription}
                      onChange={e => setShopItemDescription(e.target.value)}
                    />
                  </div>

                  {shopItemType !== 'title' && (
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-gray-400 ml-1">Gallery</label>
                      <div className="flex gap-2 items-center flex-wrap">
                        {shopItemImages.map((url, i) => (
                          <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-primary/20">
                            <img src={url} className="w-full h-full object-cover" />
                            <button onClick={() => setShopItemImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-red-500 text-white p-0.5"><X size={10} /></button>
                          </div>
                        ))}
                        <button 
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e: any) => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setShopItemImages(prev => [...prev, reader.result as string]);
                                reader.readAsDataURL(file);
                              }
                            };
                            input.click();
                          }}
                          className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-all"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={handleSaveShopItem}
                    disabled={isSubmitting}
                    className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-2 mt-4"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : editingItem ? 'Update Item' : 'Add Item'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )}

        {activeTab === 'logs' && (
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 shadow-xl border dark:border-gray-700 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-red-500/10 p-2.5 rounded-2xl text-red-600"><History size={20} /></div>
                <h3 className="font-black text-sm uppercase tracking-widest text-gray-800 dark:text-white">System Logs</h3>
              </div>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto hide-scrollbar">
              {logs.map(log => (
                <div 
                  key={log.id} 
                  onClick={() => setSelectedLog(log)}
                  className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border dark:border-gray-700 space-y-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-red-600 uppercase">{log.action}</span>
                      <span className="text-[8px] font-black text-gray-400 uppercase">by {log.adminUsername || 'System'}</span>
                    </div>
                    <span className="text-[8px] font-black text-gray-400 uppercase">{formatFullTimestamp(log.timestamp)}</span>
                  </div>
                  <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 leading-snug line-clamp-2">{log.details}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showLockdownConfirm && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 w-full max-w-sm border-4 border-red-600 shadow-2xl animate-pop-in space-y-6 text-center">
            <div className="bg-red-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]">
              <ShieldAlert size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Confirm Lockdown?</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                This will immediately disconnect all non-admin users.
              </p>
            </div>
            
            <div className="flex flex-col gap-2">
              <button 
                onClick={handleToggleLockdown}
                className="w-full bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-lg shadow-red-600/20 active:scale-95 transition-all"
              >
                Initiate Lockdown
              </button>
              <button 
                onClick={() => setShowLockdownConfirm(false)}
                className="w-full py-4 text-gray-400 font-black text-[10px] uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 w-full max-w-sm border dark:border-gray-700 shadow-2xl animate-pop-in space-y-6 relative">
            <button 
              onClick={() => setSelectedLog(null)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X size={24} />
            </button>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-red-500/10 p-3 rounded-2xl text-red-600">
                  <History size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Log Details</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{formatFullTimestamp(selectedLog.timestamp)}</p>
                </div>
              </div>

              <div className="space-y-4 bg-gray-50 dark:bg-gray-900/50 p-5 rounded-3xl border dark:border-gray-800">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Action</p>
                  <p className="text-sm font-black text-red-600 uppercase">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Admin</p>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{selectedLog.adminUsername || 'System'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Full Description</p>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{selectedLog.details}</p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedLog(null)}
                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 transition-all"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {itemToDelete && (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 w-full max-w-sm border dark:border-gray-700 shadow-2xl animate-pop-in text-center space-y-6">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-500 mx-auto">
              <Trash2 size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Delete Item?</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">This action cannot be undone.</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl font-black uppercase text-xs tracking-widest"
              >Cancel</button>
              <button 
                onClick={handleDeleteShopItem}
                className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-red-500/20"
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      {showPurgeConfirm && (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 w-full max-w-sm border dark:border-gray-700 shadow-2xl animate-pop-in text-center space-y-6">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-500 mx-auto">
              <ShieldAlert size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Purge All Zones?</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">This will permanently delete all multiplier zones.</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowPurgeConfirm(false)}
                className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl font-black uppercase text-xs tracking-widest"
              >Cancel</button>
              <button 
                onClick={handlePurgeZones}
                className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-red-500/20 flex items-center justify-center"
                disabled={isSubmitting}
              >{isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Purge All'}</button>
            </div>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 w-full max-w-sm border dark:border-gray-700 shadow-2xl animate-pop-in text-center space-y-6">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-500 mx-auto">
              <Zap size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Clear Interactions?</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">This will clear all reactions and replies from the active global broadcast.</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl font-black uppercase text-xs tracking-widest"
              >Cancel</button>
              <button 
                onClick={handleClearInteractions}
                className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-red-500/20 flex items-center justify-center"
                disabled={isSubmitting}
              >{isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Clear All'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};