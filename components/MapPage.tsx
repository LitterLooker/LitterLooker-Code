import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap, Rectangle, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Navigation, Search, Loader2, ArrowRight, MapPin as PinIcon, Lock, Camera, X, Link as LinkIcon, Sparkles, Flame, Leaf, Recycle, Crown, ShieldCheck, Globe, Trees, Crosshair, Zap, ExternalLink, Users, Calendar, Clock as ClockIcon, UserPlus, AlertCircle, User, Layers, Info, Star, CheckCircle2 } from 'lucide-react';
import { UserProfile, MapPin, ProgressReport, UrgencyLevel, MultiplierZone, GroupCleanup } from '../types';
import { PinItem } from './PinItem';
import { UserTagPicker } from './UserTagPicker';
import { getRankInfo, getLocalDateString, getUrgencyHexColor, formatFullTimestamp, getMultiplierColor, calculateDistance, calculateCredibilityScore, compressImage, recordDailyScrap } from '../utils';
import { analyzeLitterImage, searchNearbyWasteFacilities, checkSubmissionIntegrity } from '../services/gemini';
import { db, OperationType, handleFirestoreError } from '../services/firebase';
import { collection, doc, setDoc, updateDoc, increment, arrayUnion, getDoc } from 'firebase/firestore';
import { EDUCATIONAL_TRIVIA_TIPS } from '../constants';

// Custom Leaflet Icons
const iconCache: Record<string, L.DivIcon> = {};

const createCustomIcon = (color: string, innerChar: string = '') => {
  const cacheKey = `${color}-${innerChar}`;
  if (iconCache[cacheKey]) {
    return iconCache[cacheKey];
  }
  
  const icon = L.divIcon({
    className: 'custom-pin-marker',
    html: `
      <div class="pin-anchor">
        <div class="pin-bg" style="background: ${color}"></div>
        <div class="pin-icon-inner" style="color: white; font-weight: bold;">${innerChar}</div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });
  
  iconCache[cacheKey] = icon;
  return icon;
};

const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `
    <div class="user-location-container">
      <div class="user-pulse-halo"></div>
      <div class="user-location-dot"></div>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24]
});

// Map Events Component to handle clicks and center changes
const MapEvents: React.FC<{ 
  onClick: (lat: number, lng: number) => void;
  onMoveEnd: (center: { lat: number, lng: number }) => void;
}> = ({ onClick, onMoveEnd }) => {
  useMapEvents({
    click: (e) => onClick(e.latlng.lat, e.latlng.lng),
    moveend: (e) => {
      const center = e.target.getCenter();
      onMoveEnd({ lat: center.lat, lng: center.lng });
    }
  });
  return null;
};

// Component to handle map resizing when visibility changes
const MapResizer: React.FC<{ isVisible: boolean }> = ({ isVisible }) => {
  const map = useMap();
  useEffect(() => {
    if (isVisible) {
      map.invalidateSize();
      const t1 = setTimeout(() => map.invalidateSize(), 100);
      const t2 = setTimeout(() => map.invalidateSize(), 300);
      const t3 = setTimeout(() => map.invalidateSize(), 600);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [isVisible, map]);
  return null;
};

export const MapPage: React.FC<{ 
  user: UserProfile; 
  allUsers: Record<string, UserProfile>; 
  pins: MapPin[]; 
  onAddPin: (p: MapPin) => void;
  onDeletePin: (id: string) => void;
  focusPinId: string | null; 
  setFocusPinId: (id: string | null) => void; 
  onViewProfile: (id: string) => void; 
  onShowNotification: (msg: string, type: 'success' | 'error' | 'warning') => void; 
  isImageDuplicate: (url: string) => boolean; 
  isLockedDown: boolean; 
  onPinAction: (wasCleared: boolean, contributors?: string[]) => void; 
  onUpdateUser: (u: UserProfile) => void; 
  onUpdateAllUsers: (map: Record<string, UserProfile>) => void; 
  onAddProgress: (pinId: string, report: ProgressReport) => Promise<void>; 
  onUpdatePinUrgency: (id: string, u: UrgencyLevel) => void; 
  onUpdatePinIntensity: (id: string, intensity: number) => Promise<void>;
  userLocation: {lat: number, lng: number} | null;
  zones: MultiplierZone[];
  isVisible?: boolean;
  groupCleanups: GroupCleanup[];
  onAddGroupCleanup: (c: GroupCleanup) => Promise<void>;
  features: Record<string, boolean>;
  onRetrySync?: () => void;
}> = ({ user, allUsers, pins, onAddPin, onDeletePin, focusPinId, setFocusPinId, onViewProfile, onShowNotification, isImageDuplicate, isLockedDown, onPinAction, onUpdateUser, onUpdateAllUsers, onAddProgress, onUpdatePinUrgency, onUpdatePinIntensity, userLocation, zones, isVisible, groupCleanups, onAddGroupCleanup, features, onRetrySync }) => {
  const [description, setDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingCleanup, setIsAddingCleanup] = useState(false);
  const [showCleanupRequirements, setShowCleanupRequirements] = useState(false);
  const [showCleanupReportModal, setShowCleanupReportModal] = useState<GroupCleanup | null>(null);
  const [showSignupInfo, setShowSignupInfo] = useState<GroupCleanup | null>(null);
  const [reportPhotos, setReportPhotos] = useState<string[]>([]);
  const [cleanupStartTime, setCleanupStartTime] = useState('');
  const [cleanupEndTime, setCleanupEndTime] = useState('');
  const [cleanupTitle, setCleanupTitle] = useState('');
  const [cleanupDescription, setCleanupDescription] = useState('');
  const [cleanupInvites, setCleanupInvites] = useState<string[]>([]);
  const [cleanupMaxParticipants, setCleanupMaxParticipants] = useState<string>('');
  const [cleanupIsPrivate, setCleanupIsPrivate] = useState(false);
  const [cleanupAttendees, setCleanupAttendees] = useState<{username: string, efficiency: number}[]>([]);
  const [showOrganizerRatingModal, setShowOrganizerRatingModal] = useState<GroupCleanup | null>(null);
  const [organizerRating, setOrganizerRating] = useState(5);
  const [organizerComment, setOrganizerComment] = useState('');
  const [pinImages, setPinImages] = useState<string[]>([]);
  const [previewLocation, setPreviewLocation] = useState<{lat: number, lng: number} | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{ text: string, sources: any[] } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const activeTip = useMemo(() => {
    if (!isSubmitting) return "";
    return EDUCATIONAL_TRIVIA_TIPS[Math.floor(Math.random() * EDUCATIONAL_TRIVIA_TIPS.length)];
  }, [isSubmitting]);

  const [aiFailedAttempts, setAiFailedAttempts] = useState(0);
  const [manualIntensity, setManualIntensity] = useState<number>(50);
  const [tempFacilityPins, setTempFacilityPins] = useState<{lat: number, lng: number, name: string}[]>([]);
  const [showManualUrgencySelection, setShowManualUrgencySelection] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [isHeatmapLoaded, setIsHeatmapLoaded] = useState(false);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);
  
  const mapRef = useRef<L.Map | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const levelInfo = getRankInfo(user.totalXP);
  const userLevel = levelInfo.level;
  const isBlockedByWarnings = (user.warningCount || 0) > userLevel && (Date.now() - (user.lastWarningAt || 0)) < 3600000;
  const isCurrentlyBlocked = !!(user.blockedUntil && user.blockedUntil > Date.now());

  const radiusFilteredPins = useMemo(() => {
    const activePins = pins.filter(p => p.status !== 'cleaned');
    const filterRadius = user.mapRadiusFilter || 100;
    if (!userLocation) return activePins;
    return activePins.filter(pin => {
      if (focusPinId && pin.id === focusPinId) return true;
      if (user && (pin.userId === user.id || pin.username === user.username)) return true;
      const pinLat = Number(pin.lat);
      const pinLng = Number(pin.lng);
      if (isNaN(pinLat) || isNaN(pinLng)) return true;
      const distMeters = calculateDistance(userLocation.lat, userLocation.lng, pinLat, pinLng);
      const distMiles = distMeters / 1609.34;
      return distMiles <= Math.max(filterRadius * 1.5, 25);
    });
  }, [pins, userLocation, user.mapRadiusFilter, focusPinId, user]);

  const radiusFilteredGroupCleanups = useMemo(() => {
    const filterRadius = user.mapRadiusFilter || 100;
    if (!userLocation) return groupCleanups;
    return groupCleanups.filter(cleanup => {
      const distMeters = calculateDistance(userLocation.lat, userLocation.lng, cleanup.lat, cleanup.lng);
      const distMiles = distMeters / 1609.34;
      return distMiles <= Math.max(filterRadius * 1.5, 25);
    });
  }, [groupCleanups, userLocation, user.mapRadiusFilter]);

  const hasInitialCenteredRef = useRef(false);

  // Auto-center on user when map is first visible
  useEffect(() => {
    if (!isVisible) {
      hasInitialCenteredRef.current = false;
      return;
    }
    if (isVisible && userLocation && mapRef.current && !focusPinId && !hasInitialCenteredRef.current) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 15);
      hasInitialCenteredRef.current = true;
    }
  }, [isVisible, userLocation, focusPinId]);

  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  useEffect(() => {
    if (focusPinId && mapRef.current) {
      const pin = pins.find(p => p.id === focusPinId) || groupCleanups.find(c => c.id === focusPinId);
      if (pin) {
        mapRef.current.setView([pin.lat, pin.lng], 17);
      }
    }
  }, [focusPinId, pins, groupCleanups]);

  const centerOnMe = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 17);
      return;
    }
    
    if (!navigator.geolocation) {
      onShowNotification("Geolocation not supported by this browser.", "error");
      return;
    }

    onShowNotification("Requesting GPS signal...", "warning");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 17);
        onShowNotification("GPS Signal Acquired!", "success");
      },
      (err) => {
        let errorMsg = "GPS Unavailable. Check device settings.";
        if (err.code === err.PERMISSION_DENIED) errorMsg = "GPS Permission denied.";
        else if (err.code === err.POSITION_UNAVAILABLE) errorMsg = "GPS Position unavailable.";
        else if (err.code === err.TIMEOUT) errorMsg = "GPS request timed out.";
        onShowNotification(errorMsg, "error");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  };

  const [reportingUser, setReportingUser] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');

  const handleReportUser = async () => {
    if (!reportingUser || !reportReason.trim() || !showCleanupReportModal) return;
    setIsSubmitting(true);
    try {
      const targetUser = (Object.values(allUsers) as UserProfile[]).find(u => u.username === reportingUser);
      if (!targetUser) return;
      
      const report = {
        id: `report_${Date.now()}`,
        targetId: targetUser.id,
        targetType: 'user',
        reporterId: user.id,
        reason: reportReason.trim(),
        timestamp: Date.now(),
        status: 'pending',
        cleanupId: showCleanupReportModal.id
      };
      
      try {
        await setDoc(doc(db, 'moderation', report.id), report);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.CREATE, `moderation/${report.id}`);
      }
      onShowNotification(`Reported ${reportingUser} successfully.`, 'success');
      setReportingUser(null);
      setReportReason('');
    } catch (err) {
      console.error('Error reporting user:', err);
      onShowNotification('Failed to report user', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteCleanup = async () => {
    if (!showCleanupReportModal) return;
    setIsSubmitting(true);
    try {
      const finalAttendees = (showCleanupReportModal.participatorUsernames || []).map(username => {
        const attendee = cleanupAttendees.find(a => a.username === username);
        const efficiency = attendee ? attendee.efficiency / 100 : 1;
        return {
          username,
          efficiency,
          rewardScrap: Math.round(100 * efficiency)
        };
      });

      try {
        await updateDoc(doc(db, 'pins', showCleanupReportModal.id), {
          isCompleted: true,
          attendees: finalAttendees,
          completedAt: Date.now()
        });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `pins/${showCleanupReportModal.id}`);
      }

      // Update user scrap (simplified)
      for (const attendee of finalAttendees) {
        const u = (Object.values(allUsers) as UserProfile[]).find(u => u.username === attendee.username);
        if (u) {
          const updatedUser = recordDailyScrap(u, attendee.rewardScrap);
          await updateDoc(doc(db, 'users', u.id), {
            availableXP: updatedUser.availableXP,
            totalXP: updatedUser.totalXP,
            availableScrap: updatedUser.availableScrap,
            monthlyXP: updatedUser.monthlyXP,
            dailyEarnings: updatedUser.dailyEarnings
          });
        }
      }

      onShowNotification('Cleanup completed successfully!', 'success');
      setShowCleanupReportModal(null);
    } catch (err) {
      console.error('Error completing cleanup:', err);
      onShowNotification('Failed to complete cleanup', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRateOrganizer = async () => {
    if (!showOrganizerRatingModal) return;
    setIsSubmitting(true);
    try {
      const ratingObj = {
        userId: user.id,
        username: user.username,
        rating: organizerRating,
        comment: organizerComment,
        timestamp: Date.now()
      };

      try {
        await updateDoc(doc(db, 'pins', showOrganizerRatingModal.id), {
          organizerRatings: arrayUnion(ratingObj)
        });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `pins/${showOrganizerRatingModal.id}`);
      }

      onShowNotification('Rating submitted!', 'success');
      setShowOrganizerRatingModal(null);
      setOrganizerComment('');
      setOrganizerRating(5);
    } catch (err) {
      console.error('Error rating organizer:', err);
      onShowNotification('Failed to submit rating', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLocationSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!locationSearchQuery.trim()) return;

    const query = locationSearchQuery.trim().toLowerCase();

    // 1. Try Coordinate Search (lat, lng)
    const coordMatch = query.match(/^([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        mapRef.current?.setView([lat, lng], 16);
        return;
      }
    }

    // 2. Try Local Search (Pins & Cleanups)
    const localMatch = [...pins, ...groupCleanups].find(item => {
      const desc = ('description' in item ? item.description : item.title) || '';
      return desc.toLowerCase().includes(query) || item.username.toLowerCase().includes(query);
    });

    if (localMatch) {
      mapRef.current?.setView([localMatch.lat, localMatch.lng], 17);
      setFocusPinId(localMatch.id);
      return;
    }

    // 3. Try Online Geocoding (Nominatim)
    if (isOnline) {
      setIsGeocoding(true);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          mapRef.current?.setView([parseFloat(lat), parseFloat(lon)], 16);
        } else {
          onShowNotification("Location not found.", "warning");
        }
      } catch (err) {
        onShowNotification("Geocoding service unavailable.", "error");
      } finally {
        setIsGeocoding(false);
      }
    } else {
      onShowNotification("Offline: Searching local pins only.", "warning");
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (isAdding || isAddingCleanup) {
      setPreviewLocation({ lat, lng });
    }
  };

  const handleConfirmPin = async () => {
    if (isSubmitting) return;
    if (isLockedDown || isCurrentlyBlocked || isBlockedByWarnings) { onShowNotification("Reports disabled.", "warning"); return; }
    if (!description.trim() || pinImages.length === 0 || !previewLocation) { onShowNotification("Missing details.", "warning"); return; }

    // Anti-cheat: Daily Pin Limit (Combined with posts)
    const today = getLocalDateString();
    const isNewDay = user.lastActionDate !== today;
    const currentDailyPins = isNewDay ? 0 : (user.dailyPinsCount || 0);
    const currentDailyPosts = isNewDay ? 0 : (user.dailyPostsCount || 0);
    const totalDailyActions = currentDailyPins + currentDailyPosts;
    const maxDailyActions = userLevel;

    if (totalDailyActions >= maxDailyActions) {
      onShowNotification(`Daily limit reached! Level ${userLevel} users can post/pin ${maxDailyActions} times total per day.`, "warning");
      return;
    }

    // Anti-cheat: Cooldown Enforcement (3 Minutes)
    const now = Date.now();
    const COOLDOWN_MS = 3 * 60 * 1000;
    if (user.lastPinAt && (now - user.lastPinAt < COOLDOWN_MS)) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - user.lastPinAt)) / 1000);
      onShowNotification(`Take a breather! Action cooldown: ${remaining}s remaining.`, "warning");
      return;
    }

    // Anti-cheat: Distance Enforcement (10 Miles)
    if (userLocation && previewLocation) {
      const distance = calculateDistance(userLocation.lat, userLocation.lng, previewLocation.lat, previewLocation.lng);
      if (distance > 16093.4) { // 10 miles in meters
        onShowNotification("You cannot place a pin more than 10 miles away.", "warning");
        return;
      }
    } else if (!userLocation) {
      onShowNotification("GPS Signal required to verify proximity.", "error");
      return;
    }

    if (pinImages.length === 0) {
      onShowNotification("At least one photo is required.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      // AI Submission Integrity Check
      const integrityResult = await checkSubmissionIntegrity(pinImages[0], description, "Pin Submission");
      if (integrityResult.error) {
        // Fallback or continue if AI error
      } else if (!integrityResult.isLegit) {
        onShowNotification(`Anti-Cheat Alert: ${integrityResult.reason || "Suspicious submission detected."}`, "error");
        setIsSubmitting(false);
        return;
      }

      const aiResult = await analyzeLitterImage(pinImages);
      if (aiResult.error) { 
        const newFailedAttempts = aiFailedAttempts + 1;
        setAiFailedAttempts(newFailedAttempts);
        
        const score = calculateCredibilityScore(user, Object.keys(allUsers).length, allUsers);
        const isHighCredibility = typeof score === 'number' && score >= 80;
        
        if (isHighCredibility && newFailedAttempts >= 2) {
          setShowManualUrgencySelection(true);
          setIsSubmitting(false);
          return;
        } else {
          onShowNotification("AI Services unavailable. Please try again.", "error"); 
          setIsSubmitting(false);
          return; 
        }
      }
      setAiFailedAttempts(0); // Reset on success
      if (aiResult.isInvalid) { onShowNotification("Photo doesn't contain litter!", "error"); setIsSubmitting(false); return; }
      completePinSubmission(aiResult.intensity);
    } catch (e) {
      onShowNotification("Submission failed.", "error");
      setIsSubmitting(false);
    }
  };

  const completePinSubmission = (intensity: number) => {
    const today = getLocalDateString();
    const isNewDay = user.lastActionDate !== today;
    const currentDailyPins = isNewDay ? 0 : (user.dailyPinsCount || 0);
    const currentDailyPosts = isNewDay ? 0 : (user.dailyPostsCount || 0);
    
    // XP reward based on intensity
    let reward = 200;
    if (intensity >= 80) reward = 1000;
    else if (intensity >= 40) reward = 500;

    const updatedUser = recordDailyScrap(user, reward);

    onUpdateUser({ 
      ...updatedUser, 
      pinsSubmittedCount: (updatedUser.pinsSubmittedCount || 0) + 1,
      lastActionDate: today,
      dailyPinsCount: currentDailyPins + 1,
      dailyPostsCount: currentDailyPosts,
      lastPinAt: Date.now()
    });
    onShowNotification(`Reported! +${reward} Scrap.`, "success");
    onAddPin({ 
      id: `${user.username}_${Date.now()}`, 
      userId: user.uid || user.id,
      username: user.username, 
      description, lat: previewLocation!.lat, lng: previewLocation!.lng, 
      timestamp: Date.now(), status: 'pending', progressReports: [], 
      imageUrl: pinImages[0], 
      mediaUrls: pinImages,
      intensity: intensity,
      urgency: intensity >= 80 ? 'extreme' : intensity >= 40 ? 'moderate' : 'light',
      design: user.selectedPinDesign,
      verified: user.isAdmin || user.permissions?.isVerified || user.permissions?.isCreator || user.permissions?.isModerator
    }); 
    setIsAdding(false); setDescription(''); setPinImages([]); setPreviewLocation(null);
    setShowManualUrgencySelection(false);
    setIsSubmitting(false);
  };

  const handleAddCleanup = async () => {
    if (!cleanupTitle.trim() || !cleanupStartTime || !cleanupEndTime || !previewLocation) {
      onShowNotification("Missing cleanup details.", "warning");
      return;
    }

    // Anti-cheat: Distance Enforcement (10 Miles)
    if (userLocation && previewLocation) {
      const distance = calculateDistance(userLocation.lat, userLocation.lng, previewLocation.lat, previewLocation.lng);
      if (distance > 16093.4) { // 10 miles in meters
        onShowNotification("You cannot schedule a cleanup more than 10 miles away.", "warning");
        return;
      }
    } else if (!userLocation) {
      onShowNotification("GPS Signal required to verify proximity.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanup: GroupCleanup = {
        id: `cleanup_${user.username}_${Date.now()}`,
        userId: user.uid || user.id,
        username: user.username,
        creatorId: user.id,
        creatorUsername: user.username,
        title: cleanupTitle,
        description: cleanupDescription,
        lat: previewLocation.lat,
        lng: previewLocation.lng,
        startTime: new Date(cleanupStartTime).getTime(),
        endTime: new Date(cleanupEndTime).getTime(),
        invitedUsernames: cleanupInvites,
        participatorUsernames: [user.username],
        maxParticipants: cleanupMaxParticipants ? parseInt(cleanupMaxParticipants) : undefined,
        timestamp: Date.now()
      };
      await onAddGroupCleanup(cleanup);
      onShowNotification("Cleanup scheduled!", "success");
      setIsAddingCleanup(false);
      setCleanupTitle('');
      setCleanupDescription('');
      setCleanupStartTime('');
      setCleanupEndTime('');
      setCleanupInvites([]);
      setCleanupMaxParticipants('');
      setPreviewLocation(null);
    } catch (err) {
      onShowNotification("Failed to schedule cleanup.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFacilitySearch = async () => {
    if (!userLocation) { onShowNotification("GPS required for facility search.", "error"); return; }
    setSearchLoading(true);
    try {
      const result = await searchNearbyWasteFacilities(userLocation.lat, userLocation.lng);
      
      const coordRegex = /\[COORD:\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\]/g;
      const coords = result.text.match(coordRegex);
      
      // Clean description: Remove [COORD: ...]
      const cleanedText = result.text.replace(coordRegex, '').trim();
      setSearchResults({ ...result, text: cleanedText });

      if (coords) {
        const lines = result.text.split('\n');
        const newFacilityPins = lines.map(line => {
          const match = line.match(/^\d+\.\s*(.+?)\s*\[COORD:\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\]/);
          if (match) {
            return { name: match[1].trim(), lat: parseFloat(match[2]), lng: parseFloat(match[3]) };
          }
          return null;
        }).filter(x => x !== null) as any[];

        setTempFacilityPins(newFacilityPins);

        if (newFacilityPins.length > 0 && mapRef.current) {
          const bounds = L.latLngBounds(newFacilityPins.map(p => [p.lat, p.lng]));
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    } catch (err) {
      onShowNotification("Search failed.", "error");
    } finally {
      setSearchLoading(false);
    }
  };

  const sortedPins = useMemo(() => { 
    if (!userLocation) return [...radiusFilteredPins].reverse(); 
    return [...radiusFilteredPins].sort((a, b) => {
      const distA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
      const distB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
      return distA - distB;
    }); 
  }, [radiusFilteredPins, userLocation]);

  return (
    <div className="p-4 space-y-4 pb-16">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 border dark:border-gray-700 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3">
          {features.ai && (
            <button onClick={handleFacilitySearch} disabled={searchLoading} className="w-full flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900/50 p-2 rounded-2xl transition-colors">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-2xl"><Search className="text-primary" size={20} /></div>
                <div className="text-left">
                  <p className="text-sm font-black text-gray-800 dark:text-gray-100">Nearby Facilities</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">AI Location Search</p>
                </div>
              </div>
              {searchLoading ? <Loader2 className="animate-spin text-primary" size={18} /> : <ArrowRight className="text-gray-300" size={18} />}
            </button>
          )}

          {!isLockedDown && !isCurrentlyBlocked && userLevel >= 5 && (
            <>
              <div className="h-px bg-gray-100 dark:bg-gray-700 mx-2" />
              <button 
                onClick={() => { 
                  setIsAddingCleanup(!isAddingCleanup); 
                  setIsAdding(false);
                  setPreviewLocation(null); 
                  if(!isAddingCleanup) centerOnMe(); 
                }} 
                className="w-full flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900/50 p-2 rounded-2xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-secondary/20 p-2.5 rounded-2xl text-green-700 dark:text-green-400"><Users size={20} /></div>
                  <div className="text-left">
                    <p className="text-sm font-black text-gray-800 dark:text-gray-100">Schedule Cleanup</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Organize a Group Event</p>
                  </div>
                </div>
                {isAddingCleanup ? <X className="text-red-500" size={18} /> : <ArrowRight className="text-gray-300" size={18} />}
              </button>
            </>
          )}
        </div>
        {searchResults && (
          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border dark:border-gray-700 animate-slide-up space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">AI Intelligence Report</span>
              <button onClick={() => { setSearchResults(null); setTempFacilityPins([]); }} className="text-gray-400 p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full"><X size={14}/></button>
            </div>
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{searchResults.text}</div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm border dark:border-gray-700 gap-2">
        <h2 className="font-bold flex items-center gap-2 shrink-0"><PinIcon className="text-primary" size={18} />Litter Map</h2>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              if (!showHeatmap && !isHeatmapLoaded) {
                setLoadingHeatmap(true);
                setTimeout(() => {
                  setIsHeatmapLoaded(true);
                  setShowHeatmap(true);
                  setLoadingHeatmap(false);
                }, 1000);
              } else {
                setShowHeatmap(!showHeatmap);
              }
            }}
            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition shadow-sm flex items-center gap-1.5 ${showHeatmap ? 'bg-orange-500 text-white shadow-orange-500/20' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
          >
            <Flame size={14} />
            {showHeatmap ? 'Heatmap On' : 'Heatmap'}
          </button>
          {!isLockedDown && !isCurrentlyBlocked && (
            <button onClick={() => { 
              if (!isAdding && !features.pins) {
                onShowNotification("Pins are currently unavailable.", "error");
                return;
              }
              const nextAdding = !isAdding;
              setIsAdding(nextAdding); 
              setIsAddingCleanup(false); 
              if (nextAdding) {
                setPreviewLocation(userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null);
              } else {
                setPreviewLocation(null);
              }
              if (!isAdding) centerOnMe(); 
            }} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition shadow-sm flex items-center gap-1.5 ${isAdding ? 'bg-red-500 text-white' : 'bg-primary text-white'}`}>
              <PinIcon size={14} />
              {isAdding ? 'Cancel' : 'Mark Litter'}
            </button>
          )}
        </div>
      </div>

      {isAddingCleanup && (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-[2.5rem] shadow-xl border-2 border-secondary space-y-4 animate-slide-up relative">
          {isSubmitting && <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 z-20 flex flex-col items-center justify-center rounded-[2.5rem]"><Loader2 className="animate-spin text-secondary mb-2" size={30} /><span className="text-sm font-black text-secondary uppercase">Scheduling...</span></div>}
          <div className="space-y-3">
            <input className="w-full bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-bold outline-none" placeholder="Cleanup Title" value={cleanupTitle} onChange={(e) => setCleanupTitle(e.target.value)} />
            <textarea className="w-full bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-medium outline-none h-16 resize-none" placeholder="Short Description" value={cleanupDescription} onChange={(e) => setCleanupDescription(e.target.value)} />
            <div className="flex gap-2">
              <input type="datetime-local" className="flex-1 bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-xl px-2 py-2 text-[10px]" value={cleanupStartTime} onChange={(e) => setCleanupStartTime(e.target.value)} />
              <input type="datetime-local" className="flex-1 bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-xl px-2 py-2 text-[10px]" value={cleanupEndTime} onChange={(e) => setCleanupEndTime(e.target.value)} />
            </div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-2xl text-[10px] text-green-700 font-bold uppercase text-center border border-green-100">Tap map to set gathering point.</div>
          <button onClick={handleAddCleanup} disabled={isSubmitting || !previewLocation} className="w-full py-4 bg-secondary text-green-900 font-black rounded-2xl shadow-lg uppercase tracking-[0.2em] text-[10px] disabled:opacity-50">Broadcast Cleanup</button>
        </div>
      )}

      {isAdding && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-xl border-2 border-primary space-y-3 animate-slide-up relative">
          {isSubmitting && (
            <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 z-20 flex flex-col items-center justify-center rounded-2xl p-6 text-center space-y-4">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <Sparkles size={28} className="text-primary animate-pulse" />
              </div>
              <div className="space-y-1">
                <span className="text-sm font-black text-primary uppercase tracking-[0.15em] block">AI Analysing Litter...</span>
                <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">Scanning images & validating location</p>
              </div>
              <div className="w-full max-w-xs p-3.5 bg-primary/5 dark:bg-primary/10 border border-primary/10 rounded-2xl space-y-1 shadow-inner">
                <p className="text-[8px] font-black text-primary uppercase tracking-[0.2em] opacity-80 flex items-center justify-center gap-1">
                  <Leaf size={10} /> Eco Fact
                </p>
                <p className="text-[10px] font-bold text-gray-600 dark:text-gray-300 leading-normal">
                  {activeTip}
                </p>
              </div>
            </div>
          )}
          <input className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-900 text-sm outline-none" placeholder="Describe the litter" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 flex items-center justify-center gap-2">
              <Camera size={14} /> {pinImages.length > 0 ? `${pinImages.length} Photos` : 'Add Photos'}
            </button>
            {pinImages.length > 0 && (
              <button onClick={() => setPinImages([])} className="py-2.5 rounded-xl border-2 border-red-100 text-red-500 text-xs font-bold flex items-center justify-center gap-2">
                <X size={14} /> Clear
              </button>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            multiple 
            onChange={(e) => { 
              const files = Array.from(e.target.files || []);
              (files as File[]).forEach(file => {
                const reader = new FileReader();
                reader.onloadend = async () => {
                  const compressed = await compressImage(reader.result as string);
                  setPinImages(prev => [...prev, compressed]);
                };
                reader.readAsDataURL(file);
              });
            }} 
            className="hidden" 
            accept="image/*" 
          />
          {pinImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {pinImages.map((img, idx) => (
                <div key={idx} className="relative shrink-0">
                  <img src={img} className="w-16 h-16 rounded-lg object-cover border dark:border-gray-700" />
                  <button onClick={() => setPinImages(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm"><X size={10}/></button>
                </div>
              ))}
            </div>
          )}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-xl text-[10px] text-blue-600 font-bold uppercase text-center">Tap map to set position.</div>
          <button onClick={handleConfirmPin} disabled={isSubmitting || !previewLocation} className="w-full py-3.5 bg-primary text-white font-black rounded-xl shadow-lg uppercase tracking-widest text-xs">Submit Report</button>
        </div>
      )}

      <div className="w-full h-[45vh] rounded-3xl overflow-hidden shadow-2xl border dark:border-gray-700 relative">
        <MapContainer 
          center={userLocation ? [userLocation.lat, userLocation.lng] : [39.1031, -84.5120]} 
          zoom={13} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapEvents onClick={handleMapClick} onMoveEnd={() => {}} />
          <MapResizer isVisible={!!isVisible} />
          
          {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon} />}
          
          {previewLocation && <Marker position={[previewLocation.lat, previewLocation.lng]} icon={createCustomIcon('#3B82F6', '?')} />}

          {showHeatmap && radiusFilteredPins.map(pin => {
            const intensity = pin.intensity !== undefined ? pin.intensity : (pin.urgency === 'extreme' ? 90 : pin.urgency === 'moderate' ? 60 : 30);
            const radiusMeters = Math.max(140, intensity * 20);
            const color = intensity >= 80 ? '#ef4444' : intensity >= 40 ? '#f59e0b' : '#10b981';
            return (
              <React.Fragment key={`heatmap-${pin.id}`}>
                <Circle 
                  center={[pin.lat, pin.lng]} 
                  radius={radiusMeters} 
                  pathOptions={{ 
                    color: color, 
                    fillColor: color, 
                    fillOpacity: 0.25,
                    weight: 0 
                  }} 
                />
                <Circle 
                  center={[pin.lat, pin.lng]} 
                  radius={radiusMeters * 0.45} 
                  pathOptions={{ 
                    color: color, 
                    fillColor: color, 
                    fillOpacity: 0.55,
                    weight: 0 
                  }} 
                />
              </React.Fragment>
            );
          })}
          
          {radiusFilteredPins.map(pin => {
            const lat = Number(pin.lat);
            const lng = Number(pin.lng);
            if (isNaN(lat) || isNaN(lng)) return null;
            return (
              <Marker 
                key={pin.id} 
                position={[lat, lng]} 
                icon={createCustomIcon(getUrgencyHexColor(pin.intensity !== undefined ? (pin.intensity >= 80 ? 'extreme' : pin.intensity >= 40 ? 'moderate' : 'light') : pin.urgency))}
                eventHandlers={{ click: () => setFocusPinId(pin.id) }}
              />
            );
          })}

          {radiusFilteredGroupCleanups.map(cleanup => {
            if (cleanup.isCompleted) return null;
            const lat = Number(cleanup.lat);
            const lng = Number(cleanup.lng);
            if (isNaN(lat) || isNaN(lng)) return null;
            return (
              <Marker 
                key={cleanup.id} 
                position={[lat, lng]} 
                icon={createCustomIcon('#166534', 'G')}
                eventHandlers={{ click: () => setFocusPinId(cleanup.id) }}
              />
            );
          })}

          {zones.map(zone => (
            <Circle 
              key={zone.id} 
              center={[zone.lat, zone.lng]} 
              radius={zone.radius} 
              pathOptions={{ color: getMultiplierColor(zone.multiplier), fillColor: getMultiplierColor(zone.multiplier), fillOpacity: 0.2 }} 
            />
          ))}

          {tempFacilityPins.map((fp, i) => (
            <Marker key={i} position={[fp.lat, fp.lng]} icon={createCustomIcon('#10B981', '♻️')}>
              <Popup>
                <div className="flex flex-col gap-2">
                  <span className="font-bold text-sm">{fp.name}</span>
                  <button 
                    onClick={() => {
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fp.name)}`, '_blank');
                    }}
                    className="text-xs bg-primary text-white p-2 rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Get Directions
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          <ScaleControl 
            position="bottomleft" 
            metric={user?.measurementSystem === 'metric' || !user?.measurementSystem} 
            imperial={user?.measurementSystem === 'imperial'} 
          />
        </MapContainer>
        
        <div className="absolute top-4 left-4 right-4 z-[1000] flex gap-2">
          <form onSubmit={handleLocationSearch} className="flex-1 relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
              {isGeocoding ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </div>
            <input 
              type="text"
              value={locationSearchQuery}
              onChange={(e) => setLocationSearchQuery(e.target.value)}
              placeholder="Search location or pins..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-white/20 dark:border-gray-700 rounded-2xl text-xs font-bold shadow-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </form>
          <button onClick={() => handleLocationSearch()} className="bg-primary text-white p-2.5 rounded-2xl shadow-xl active:scale-95 transition-all"><Navigation size={20} /></button>
        </div>
        <button onClick={centerOnMe} className="absolute bottom-6 left-4 z-[1000] bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xl border dark:border-gray-700 text-primary active:scale-95 transition-all"><Crosshair size={24} /></button>
      </div>

      {showHeatmap && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl border dark:border-gray-700 shadow-sm space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1.5">
              <Flame size={14} /> Litter Density Distribution
            </span>
            <span className="text-[10px] font-bold text-gray-400">{radiusFilteredPins.length} Active Reports</span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Light (<40%)', count: radiusFilteredPins.filter(p => (p.intensity !== undefined ? p.intensity : (p.urgency === 'extreme' ? 90 : p.urgency === 'moderate' ? 60 : 30)) < 40).length, fill: '#10b981' },
                { name: 'Moderate (40-79%)', count: radiusFilteredPins.filter(p => { const i = p.intensity !== undefined ? p.intensity : (p.urgency === 'extreme' ? 90 : p.urgency === 'moderate' ? 60 : 30); return i >= 40 && i < 80; }).length, fill: '#f59e0b' },
                { name: 'Extreme (80%+)', count: radiusFilteredPins.filter(p => (p.intensity !== undefined ? p.intensity : (p.urgency === 'extreme' ? 90 : p.urgency === 'moderate' ? 60 : 30)) >= 80).length, fill: '#ef4444' },
              ]}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb' }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="space-y-3 pt-2.5 pb-8">
        <h3 className="font-black text-[10px] text-gray-400 uppercase tracking-widest ml-1">Local Activity</h3>
        {(()=>{
          const items = [...radiusFilteredPins, ...radiusFilteredGroupCleanups].filter(item => {
            if ('creatorId' in item) {
              const cleanup = item as GroupCleanup;
              if (cleanup.isCompleted) return false;
              if (Date.now() > cleanup.endTime && cleanup.creatorId !== user.id) return false;
              if (cleanup.isPrivate && !(cleanup.invitedUsernames || []).includes(user.username) && cleanup.creatorId !== user.id) return false;
              return true;
            }
            return true;
          }).sort((a, b) => b.timestamp - a.timestamp);

          if (items.length === 0) {
            return <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center pt-4 opacity-75">Nothing yet!</p>;
          }

          return items.map(item => {
            if ('creatorId' in item) {
              const cleanup = item as GroupCleanup;
              const isFocused = focusPinId === cleanup.id;
              return (
                <div key={cleanup.id} id={`activity-${cleanup.id}`} onClick={() => setFocusPinId(cleanup.id)} className={`p-4 rounded-[2rem] bg-white dark:bg-gray-800 border-2 transition-all cursor-pointer ${isFocused ? 'border-secondary shadow-lg scale-[1.02]' : 'border-gray-100 dark:border-gray-700'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-secondary/20 p-2 rounded-xl text-green-700 dark:text-green-400"><Users size={18} /></div>
                      <div>
                        <h4 className="font-black text-xs uppercase text-gray-800 dark:text-white">{cleanup.title || 'Group Cleanup'}</h4>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Organized by @{cleanup.creatorUsername}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-gray-400 uppercase">{(cleanup.participatorUsernames || []).length} participants</span>
                    {cleanup.isCompleted ? (
                      (cleanup.participatorUsernames || []).includes(user.username) && cleanup.creatorId !== user.id && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowOrganizerRatingModal(cleanup); }}
                          className="text-[9px] font-black text-white bg-primary px-3 py-1.5 rounded-xl uppercase active:scale-95 transition-all"
                        >
                          { (cleanup.organizerRatings || []).some(r => r.userId === user.id) ? 'Rated' : 'Rate Organizer' }
                        </button>
                      )
                    ) : (
                      cleanup.creatorId === user.id ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowCleanupReportModal(cleanup); }}
                          className="text-[9px] font-black text-white bg-secondary px-3 py-1.5 rounded-xl uppercase hover:bg-green-600 transition-colors"
                        >
                          Complete Cleanup
                        </button>
                      ) : (
                        <div className="text-[9px] font-black text-secondary uppercase">Join on Map</div>
                      )
                    )}
                  </div>
                </div>
              );
            }
            const pin = item as MapPin;
            return <PinItem key={pin.id} pin={pin} user={user} allUsers={allUsers} isLockedDown={isLockedDown} onDelete={(e, id, wasCleared, contributors) => { onDeletePin(id); if (wasCleared) onPinAction(true, contributors); }} onViewProfile={onViewProfile} onAddProgress={onAddProgress} onShowNotification={onShowNotification} isImageDuplicate={() => false} onUpdatePinUrgency={onUpdatePinUrgency} onUpdatePinIntensity={onUpdatePinIntensity} isFocused={focusPinId === pin.id} onFocus={() => setFocusPinId(pin.id)} userLocation={userLocation} isMapsLoaded={true} isPendingOffline={(pin as any).isPendingOffline} onRetrySync={onRetrySync} />;
          });
        })()}
      </div>
      {showManualUrgencySelection && (
        <div className="fixed inset-0 bg-black/80 z-[6000] flex items-center justify-center p-6 animate-fade-in backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl w-full max-w-sm border dark:border-gray-700 animate-pop-in">
            <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase mb-2">Manual Intensity</h3>
            <p className="text-xs font-bold text-gray-500 mb-4">AI detection failed. Please set litter intensity (0-100).</p>
            
            <div className="w-full space-y-2 mb-6">
              <div className="flex justify-between text-xs font-black text-primary uppercase tracking-wider">
                <span>Intensity</span>
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black">
                  {Number.isNaN(manualIntensity) ? 50 : manualIntensity}%
                </span>
              </div>
              <input 
                type="range"
                min="0"
                max="100"
                value={Number.isNaN(manualIntensity) ? 50 : manualIntensity}
                className="w-full h-2 bg-gray-100 dark:bg-gray-900 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                onChange={(e) => setManualIntensity(parseInt(e.target.value, 10))}
              />
            </div>
            
            <button
              onClick={() => {
                completePinSubmission(Number.isNaN(manualIntensity) ? 50 : manualIntensity);
              }}
              className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg uppercase tracking-widest text-xs"
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {showCleanupReportModal && (
        <div className="fixed inset-0 bg-black/80 z-[6000] flex items-center justify-center p-6 animate-fade-in backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl w-full max-w-md border dark:border-gray-700 animate-pop-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase">Cleanup Report</h3>
              <button onClick={() => setShowCleanupReportModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-xs font-bold text-gray-500 mb-4 shrink-0">Rate the efficiency of participants and report any issues.</p>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 hide-scrollbar">
              {(showCleanupReportModal.participatorUsernames || []).map(username => {
                const attendee = cleanupAttendees.find(a => a.username === username) || { username, efficiency: 100 };
                return (
                  <div key={username} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-black text-sm text-gray-800 dark:text-gray-200">@{username}</span>
                      {username !== user.username && (
                        <button 
                          onClick={() => setReportingUser(username)}
                          className="text-[10px] font-black text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-lg uppercase flex items-center gap-1"
                        >
                          <AlertCircle size={12} /> Report
                        </button>
                      )}
                    </div>
                    
                    {reportingUser === username ? (
                      <div className="mt-3 space-y-2 animate-fade-in">
                        <textarea 
                          placeholder="Reason for reporting..."
                          value={reportReason}
                          onChange={(e) => setReportReason(e.target.value)}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 text-xs font-bold focus:ring-2 focus:ring-red-500 outline-none resize-none h-20"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => setReportingUser(null)} className="flex-1 py-1.5 rounded-lg font-black text-[10px] uppercase bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Cancel</button>
                          <button onClick={handleReportUser} disabled={isSubmitting || !reportReason.trim()} className="flex-1 py-1.5 rounded-lg font-black text-[10px] uppercase bg-red-500 text-white disabled:opacity-50 flex justify-center items-center">
                            {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : 'Submit Report'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                          <span>Efficiency</span>
                          <span>{attendee.efficiency}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" max="100" 
                          value={attendee.efficiency}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setCleanupAttendees(prev => {
                              const existing = prev.find(p => p.username === username);
                              if (existing) return prev.map(p => p.username === username ? { ...p, efficiency: val } : p);
                              return [...prev, { username, efficiency: val, rewardScrap: 0 }];
                            });
                          }}
                          className="w-full accent-primary"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
              <button 
                onClick={handleCompleteCleanup}
                disabled={isSubmitting}
                className="w-full p-3 rounded-xl font-black text-xs uppercase bg-secondary text-white flex justify-center items-center gap-2"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <><ShieldCheck size={16} /> Complete Cleanup</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Organizer Rating Modal */}
      {showOrganizerRatingModal && (
        <div className="fixed inset-0 bg-black/80 z-[6000] flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-900 rounded-[3rem] p-8 shadow-2xl w-full max-w-md border dark:border-gray-800">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Rate Organizer</h3>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Evaluate @{showOrganizerRatingModal.creatorUsername}</p>
              </div>
              <button onClick={() => setShowOrganizerRatingModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Rating</label>
                <div className="flex gap-2 justify-center py-4">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button 
                      key={star}
                      onClick={() => setOrganizerRating(star)}
                      className={`p-2 transition-all ${organizerRating >= star ? 'text-amber-500 scale-110' : 'text-gray-300 dark:text-gray-700'}`}
                    >
                      <Star size={32} fill={organizerRating >= star ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Comment (Optional)</label>
                <textarea 
                  value={organizerComment}
                  onChange={(e) => setOrganizerComment(e.target.value)}
                  placeholder="How was the organization?"
                  className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px] resize-none"
                />
              </div>

              <button 
                onClick={handleRateOrganizer}
                disabled={isSubmitting || (showOrganizerRatingModal.organizerRatings || []).some(r => r.userId === user.id)}
                className="w-full bg-primary text-white font-black py-5 rounded-2xl uppercase text-xs tracking-[0.2em] shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Submit Rating'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loadingHeatmap && (
        <div className="fixed inset-0 z-[100000] bg-gray-950/65 backdrop-blur-md flex items-center justify-center pointer-events-auto select-none overflow-hidden animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
          </div>
        </div>
      )}
    </div>
  );
};
