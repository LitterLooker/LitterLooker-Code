import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import * as Icons from 'lucide-react';
import { Users, Search, Plus, Trophy, Shield, UserPlus, LogOut, Settings, ChevronRight, ChevronDown, ChevronUp, Trash2, ShieldCheck, UserMinus, Globe, Lock, Camera, Save, ArrowLeft, Sparkles, X, Loader2, MessageSquare, Calendar, Send, Info, CheckCircle2, AtSign, MapPin, Image as ImageIcon, Star } from 'lucide-react';
import { MapContainer, TileLayer, Circle, useMap, Rectangle } from 'react-leaflet';

const ZoomToUserButton = ({ centerOnMe }: { centerOnMe: () => void }) => {
  return (
    <button 
      onClick={centerOnMe}
      className="absolute bottom-6 left-4 z-[1000] bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xl border dark:border-gray-700 text-primary active:scale-95 transition-all"
    >
      <Icons.Crosshair size={24} />
    </button>
  );
};

const AutoLocateHandler = ({ teamLocation }: { teamLocation?: { lat: number, lng: number } }) => {
  const map = useMap();
  useEffect(() => {
    if (teamLocation?.lat && teamLocation?.lng) {
      map.flyTo([teamLocation.lat, teamLocation.lng], 13);
    } else {
      map.locate();
      map.on('locationfound', (e) => {
        map.flyTo(e.latlng, 13);
      });
    }
  }, [map, teamLocation]);
  return null;
};

import { UserProfile, Team, TeamMessage, GroupCleanup } from '../types';
import { db, OperationType, handleFirestoreError } from '../services/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc, limit, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, deleteField, writeBatch, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { getRankInfo, sanitizeData, compressImage, calculateDistance, convertWeight, convertArea, getWeightUnit, getAreaUnit, recordDailyScrap } from '../utils';
import { CREW_CHARACTERISTICS, isRestrictedName, COMPETITION_COLORS } from '../constants';

import { ConfirmModal } from './ConfirmModal';
import { ViewProfileModal } from './ViewProfileModal';
import { UserTagPicker } from './UserTagPicker';
import { PinTagPicker } from './PinTagPicker';

interface CleanupCrewsPageProps {
  user: UserProfile;
  allUsers: Record<string, UserProfile>;
  onUpdateUser: (updated: UserProfile) => void;
  onBack: () => void;
  onShowNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  onViewProfile: (id: string) => void;
  features: Record<string, boolean>;
  pins: any[];
  groupCleanups: GroupCleanup[];
  onViewPin: (id: string) => void;
  initialTeamId?: string;
}

export const CleanupCrewsPage: React.FC<CleanupCrewsPageProps> = ({ user, allUsers, onUpdateUser, onBack, onShowNotification, onViewProfile, features, pins, groupCleanups, onViewPin, initialTeamId }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  const centerOnMe = () => {
    if (viewingTeam?.lat && viewingTeam?.lng && mapRef.current) {
      mapRef.current.setView([viewingTeam.lat, viewingTeam.lng], 13);
      return;
    }
    if (userLocation && mapRef.current) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 17);
      return;
    }
    onShowNotification("Requesting GPS signal...", "info");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 17);
        onShowNotification("GPS Signal Acquired!", "success");
      },
      (err) => {
        console.error(err);
        onShowNotification("Failed to get location", "error");
      }
    );
  };

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);
  const [viewingTab, setViewingTab] = useState<'overview' | 'events' | 'chat' | 'compete'>('overview');
  const [showMembers, setShowMembers] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);

  useEffect(() => {
    if (!user.id) return;
    const q = query(collection(db, "notifications"), where("targetUserId", "==", user.id), where("type", "==", "crew_invite"), where("read", "==", false));
    const unsub = onSnapshot(q, (snap) => {
      setPendingInvites(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, (err) => {
      console.warn("CleanupCrewsPage notifications listener error:", err);
      handleFirestoreError(err, OperationType.GET, "notifications");
    });
    return () => unsub();
  }, [user.id]);
  const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);
  const teamEvents = useMemo(() => {
    if (!viewingTeam) return [];
    return (groupCleanups || [])
      .filter(c => c.teamId === viewingTeam.id)
      .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  }, [groupCleanups, viewingTeam?.id]);
  const [newMessage, setNewMessage] = useState('');
  const [chatImage, setChatImage] = useState<string | null>(null);
  const [chatTaggedUsernames, setChatTaggedUsernames] = useState<string[]>([]);
  const [chatLinkedPinId, setChatLinkedPinId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageContent, setEditMessageContent] = useState('');
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCleanupReportModal, setShowCleanupReportModal] = useState<GroupCleanup | null>(null);
  const [cleanupAttendees, setCleanupAttendees] = useState<{username: string, efficiency: number}[]>([]);
  const [showOrganizerRatingModal, setShowOrganizerRatingModal] = useState<GroupCleanup | null>(null);
  const [organizerRating, setOrganizerRating] = useState(5);
  const [organizerComment, setOrganizerComment] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSelectedUsernames, setInviteSelectedUsernames] = useState<string[]>([]);
  const [showInviteTagPicker, setShowInviteTagPicker] = useState(false);
  const [showChatTagPicker, setShowChatTagPicker] = useState(false);
  const [showChatPinSelector, setShowChatPinSelector] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [pendingAction, setPendingAction] = useState<{ type: 'promote' | 'demote' | 'remove' | 'transfer', username: string } | null>(null);
  const [eventToCancel, setEventToCancel] = useState<string | null>(null);
  const [teamToJoin, setTeamToJoin] = useState<Team | { id: string, name: string } | null>(null);
  const [notifIdToJoin, setNotifIdToJoin] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleToggleInviteUser = (username: string) => {
    setInviteSelectedUsernames(prev => {
      const current = Array.isArray(prev) ? prev : [];
      return current.includes(username) ? current.filter(x => x !== username) : [...current, username];
    });
  };

  // Create Team State
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxSize, setMaxSize] = useState(20);
  const [selectedCharacteristics, setSelectedCharacteristics] = useState<string[]>([]);
  const [newTeamRegion, setNewTeamRegion] = useState('');
  const [newTeamRegionLat, setNewTeamRegionLat] = useState<number>(37.7749);
  const [newTeamRegionLng, setNewTeamRegionLng] = useState<number>(-122.4194);
  const [regionSearchQuery, setRegionSearchQuery] = useState('');
  const [regionResults, setRegionResults] = useState<any[]>([]);
  const [isSearchingRegion, setIsSearchingRegion] = useState(false);
  
  useEffect(() => {
    if (!regionSearchQuery) {
      setRegionResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingRegion(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(regionSearchQuery)}&featuretype=city&limit=5`);
        const data = await res.json();
        setRegionResults(data);
      } catch (e) {
        console.error("Failed to search regions", e);
      } finally {
        setIsSearchingRegion(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [regionSearchQuery]);

  const [newTeamIcon, setNewTeamIcon] = useState('🌍');
  const [newTeamBgColor, setNewTeamBgColor] = useState('bg-blue-500');
  const [newTeamMinXp, setNewTeamMinXp] = useState(0);

  const CREW_ICONS = ['🌍', '🌱', '♻️', '🌊', '🌲', '🗑️', '🧹', '🧤', '🦺', '✨', '🔥', '💧', '☀️', '🌈', '🦋', '🐢', '🐬', '🐋', '🦅', '🦉'];
  const CREW_COLORS = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500', 
    'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 
    'bg-pink-500', 'bg-rose-500', 'bg-slate-500', 'bg-gray-500', 'bg-zinc-500'
  ];

  const hasSetInitialTeam = useRef(false);

  useEffect(() => {
    if (!features.crews) {
      setLoading(false);
      onBack();
      return;
    }
    
    setLoading(true);
    const q = query(collection(db, 'teams'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      
      const validTeams: Team[] = [];
      teamsData.forEach(team => {
        if (!Array.isArray(team.members) || team.members.length === 0) {
          deleteDoc(doc(db, 'teams', team.id)).catch(console.error);
        } else {
          validTeams.push(team);
        }
      });

      const sortedTeams = validTeams.sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0));
      setTeams(sortedTeams);
      
      if (!hasSetInitialTeam.current) {
        const targetId = initialTeamId || user.teamId;
        if (targetId) {
          let teamToView = sortedTeams.find(t => t.id === targetId);
          if (teamToView) {
            setViewingTeam(teamToView);
            hasSetInitialTeam.current = true;
            setLoading(false);
          } else {
            getDoc(doc(db, 'teams', targetId)).then(snap => {
              if (snap.exists()) {
                setViewingTeam({ id: snap.id, ...snap.data() } as Team);
              }
              hasSetInitialTeam.current = true;
              setLoading(false);
            }).catch(err => {
              console.error("Failed to fetch initial team", err);
              hasSetInitialTeam.current = true;
              setLoading(false);
            });
          }
        } else {
          hasSetInitialTeam.current = true;
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'teams');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [features.crews, initialTeamId, user.teamId]);

  const fetchTeams = async () => {
    // This is now handled by the useEffect onSnapshot
  };

  useEffect(() => {
    if (viewingTeam) {
      const unsubscribe = onSnapshot(doc(db, 'teams', viewingTeam.id), (docSnap) => {
        if (docSnap.exists()) {
          setViewingTeam({ id: docSnap.id, ...docSnap.data() } as Team);
        } else {
          setViewingTeam(null);
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, `teams/${viewingTeam.id}`));
      return () => unsubscribe();
    }
  }, [viewingTeam?.id]);

  useEffect(() => {
    if (viewingTeam && user.username && (Array.isArray(viewingTeam.members) ? viewingTeam.members : []).includes(user.username)) {
      const q = query(
        collection(db, 'teamMessages'),
        where('teamId', '==', viewingTeam.id),
        limit(100)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamMessage));
        setTeamMessages(msgs.sort((a, b) => a.timestamp - b.timestamp));
      }, (err) => handleFirestoreError(err, OperationType.GET, `teamMessages/${viewingTeam.id}`));
      return () => unsubscribe();
    } else {
      setTeamMessages([]);
    }
  }, [viewingTeam?.id, user.username, viewingTeam?.members]);

  // Separate effect for scrolling to keep the listener stable
  useEffect(() => {
    if (viewingTab === 'chat' && teamMessages.length > 0) {
      const timer = setTimeout(() => {
        if (chatEndRef.current) {
          const parent = chatEndRef.current.closest('.overflow-y-auto');
          if (parent) {
            parent.scrollTo({ top: parent.scrollHeight, behavior: 'smooth' });
          } else {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [viewingTab, teamMessages.length]);



  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || isCreating) return;
    
    if (isRestrictedName(newTeamName)) {
      onShowNotification('Crew name cannot be a level or title!', 'error');
      return;
    }

    if (teams.some(t => t.name.toLowerCase() === newTeamName.trim().toLowerCase())) {
      onShowNotification('A crew with this name already exists!', 'error');
      return;
    }

    if (selectedCharacteristics.length === 0) {
      onShowNotification('Pick at least one characteristic!', 'error');
      return;
    }

    if (!newTeamRegion.trim()) {
      onShowNotification('Please specify a region (city)!', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const teamId = newTeamName.trim();
      
      const teamsInRegion = teams.filter(t => t.lat && t.lng && calculateDistance(t.lat, t.lng, newTeamRegionLat, newTeamRegionLng) < 50);
      const shardIds: string[] = Array.from(new Set(teamsInRegion.map(t => t.shardId).filter((s): s is string => !!s)));
      
      let assignedShardId = '';
      let assignedColor = '';
      
      for (const shardId of shardIds) {
        const teamsInShard = teamsInRegion.filter(t => t.shardId === shardId);
        if (teamsInShard.length < 10) {
          assignedShardId = shardId || '';
          assignedColor = teamsInShard[0]?.competitionColor || COMPETITION_COLORS[0];
          break;
        }
      }
      
      if (!assignedShardId) {
        assignedShardId = `${newTeamRegion.trim().toLowerCase().replace(/\s+/g, '_')}_${shardIds.length + 1}`;
        assignedColor = COMPETITION_COLORS[shardIds.length % COMPETITION_COLORS.length];
      }

      const newTeam: Team = {
        id: teamId,
        name: newTeamName.trim(),
        description: newTeamDesc.trim(),
        creatorId: user.uid || user.id, // Prefer UID
        creatorUsername: user.username,
        members: [user.username],
        admins: [user.username],
        memberUids: [user.uid || user.id],
        adminUids: [user.uid || user.id],
        joinedAt: Date.now(),
        isPrivate,
        joinRequests: [],
        maxSize: Math.min(50, Math.max(2, Number.isNaN(maxSize) ? 20 : maxSize)),
        characteristics: selectedCharacteristics,
        region: newTeamRegion.trim(),
        lat: newTeamRegionLat,
        lng: newTeamRegionLng,
        icon: newTeamIcon,
        backgroundColor: newTeamBgColor,
        totalArea: 0,
        dailyArea: 0,
        minXp: Number.isNaN(newTeamMinXp) ? 0 : newTeamMinXp,
        shardId: assignedShardId,
        competitionColor: assignedColor,
        litterStats: {
          weightKg: 0,
          areaSqM: 0,
          piecesCount: 0
        },
        litterStatsHistory: []
      };

      await setDoc(doc(db, 'teams', teamId), sanitizeData(newTeam));
      onUpdateUser({ ...user, teamId, teamName: newTeam.name, teamRole: 'creator' });
      setShowCreateModal(false);
      onShowNotification('Crew founded successfully!', 'success');
    } catch (err) {
      console.error('Error creating team:', err);
      onShowNotification('Failed to create crew.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinTeam = async (team: Team) => {
    if (user.teamId === team.id) {
      onShowNotification('You are already in this crew!', 'info');
      return;
    }
    
    if ((Array.isArray(team.members) ? team.members : []).length >= (team.maxSize || 50)) {
      onShowNotification('This crew is full!', 'error');
      return;
    }

    const pendingInvite = pendingInvites.find(i => i.teamId === team.id) || (user.crewInvites || []).find(i => i.teamId === team.id);

    // Only check restrictions if NOT invited
    if (!pendingInvite) {
      if (team.region && user.region && team.region.toLowerCase() !== user.region.toLowerCase()) {
        onShowNotification(`This crew is restricted to users in ${team.region}!`, 'error');
        return;
      }

      if (team.minXp && user.totalXP < team.minXp) {
        onShowNotification(`You need at least ${team.minXp} XP to join this crew!`, 'error');
        return;
      }
    }

    setTeamToJoin(team);
    setNotifIdToJoin(pendingInvite && 'id' in pendingInvite ? pendingInvite.id : null);
  };

  const confirmJoinTeam = async () => {
    if (!teamToJoin) return;
    const teamId = teamToJoin.id;
    const teamName = teamToJoin.name;
    const notifId = notifIdToJoin;

    try {
      console.log("Attempting to join team:", teamId, "User:", user.id, "Username:", user.username);
      const teamRef = doc(db, 'teams', teamId);
      const teamSnap = await getDoc(teamRef);
      if (!teamSnap.exists()) {
        console.error("Team does not exist:", teamId);
        onShowNotification('Crew no longer exists.', 'error');
        setTeamToJoin(null);
        setNotifIdToJoin(null);
        return;
      }
      console.log("Team exists, proceeding with updates.");

      // If already in a team, leave it first
      if (user.teamId) {
        console.log("Leaving old team:", user.teamId);
        const oldTeamRef = doc(db, 'teams', user.teamId);
        const oldTeamSnap = await getDoc(oldTeamRef);
        if (oldTeamSnap.exists()) {
          const oldTeamData = oldTeamSnap.data() as Team;
          const isCreator = oldTeamData.creatorId === (user.uid || user.id);
          const memberCount = (Array.isArray(oldTeamData.members) ? oldTeamData.members : []).length;

          if (isCreator && memberCount > 1) {
            onShowNotification('Please transfer crew ownership before switching crews.', 'error');
            setTeamToJoin(null);
            setIsCreating(false);
            return;
          }

          await updateDoc(oldTeamRef, {
            members: arrayRemove(user.username),
            admins: arrayRemove(user.username),
            memberUids: arrayRemove(user.uid || user.id),
            adminUids: arrayRemove(user.uid || user.id)
          });
          console.log("Successfully left old team");
        } else {
          console.log("Old team no longer exists, skipping leave logic");
        }
      }

      console.log("Updating new team:", teamId);
      await updateDoc(teamRef, {
        members: arrayUnion(user.username),
        memberUids: arrayUnion(user.uid)
      });
      console.log("Successfully updated new team");

      const updates: any = {
        teamId: teamId,
        teamName: teamName,
        teamRole: 'member'
      };

      console.log("Updating user:", user.id);
      let nextCrewInvites = user.crewInvites || [];
      if (user.crewInvites) {
        const inviteToRemove = user.crewInvites.find(i => i.teamId === teamId);
        if (inviteToRemove) {
          await updateDoc(doc(db, 'users', user.id), {
            ...updates,
            crewInvites: arrayRemove(inviteToRemove)
          });
          nextCrewInvites = user.crewInvites.filter(i => i.teamId !== teamId);
        } else {
          await updateDoc(doc(db, 'users', user.id), updates);
        }
      } else {
        await updateDoc(doc(db, 'users', user.id), updates);
      }
      console.log("Successfully updated user");

      if (notifId) {
        console.log("Updating notification:", notifId);
        await updateDoc(doc(db, 'notifications', notifId), { read: true });
        console.log("Successfully updated notification");
      }

      onUpdateUser({ 
        ...user, 
        ...updates,
        crewInvites: nextCrewInvites
      });
      onShowNotification(`Welcome to ${teamName}!`, 'success');
      
      const team = teams.find(t => t.id === teamId) || ({ id: teamId, ...teamSnap.data() } as Team);
      setViewingTeam(team);
      setTeamToJoin(null);
      setNotifIdToJoin(null);
    } catch (err) {
      console.error('Error joining team:', err);
      // @ts-ignore
      console.error('Error details:', err.code, err.message);
      onShowNotification('Failed to join crew', 'error');
      setTeamToJoin(null);
      setNotifIdToJoin(null);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !chatImage) || !viewingTeam) return;
    try {
      const messageId = `${user.username}_${Date.now()}`;
      const messageData: any = {
        id: messageId,
        teamId: viewingTeam.id,
        userId: user.id,
        username: user.username,
        content: newMessage.trim(),
        timestamp: Date.now(),
        ttlTimestamp: Date.now(), // Field for Firestore TTL
      };

      if (user.profilePicture) messageData.userProfilePicture = user.profilePicture;
      if (chatImage) messageData.imageUrl = chatImage;
      if (chatTaggedUsernames.length > 0) messageData.taggedUsernames = chatTaggedUsernames;
      if (chatLinkedPinId) messageData.linkedPinId = chatLinkedPinId;

      await setDoc(doc(db, 'teamMessages', messageId), sanitizeData(messageData));
      
      setNewMessage('');
      setChatImage(null);
      setChatTaggedUsernames([]);
      setChatLinkedPinId(null);
    } catch (err) {
      console.error('Error sending message:', err);
      onShowNotification('Failed to send message. Please try again.', 'error');
    }
  };

  const handleUpdateMessage = async (messageId: string) => {
    if (!editMessageContent.trim()) return;
    try {
      await updateDoc(doc(db, 'teamMessages', messageId), {
        content: editMessageContent.trim()
      });
      setEditingMessageId(null);
      setEditMessageContent('');
    } catch (err) {
      console.error('Error updating message:', err);
      onShowNotification('Failed to update message.', 'error');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, 'teamMessages', messageId));
    } catch (err) {
      console.error('Error deleting message:', err);
      onShowNotification('Failed to delete message.', 'error');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!viewingTeam) return;
    
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const startTime = new Date(formData.get('startTime') as string).getTime();
    const endTime = new Date(formData.get('endTime') as string).getTime();
    
    if (endTime <= startTime) {
      onShowNotification('End time must be after start time', 'error');
      return;
    }
    
    try {
      const eventId = `event_${Date.now()}`;
      const newEvent: GroupCleanup = {
        id: eventId,
        userId: user.id,
        username: user.username,
        creatorId: user.id,
        creatorUsername: user.username,
        title,
        description,
        lat: 0, 
        lng: 0,
        startTime,
        endTime,
        invitedUsernames: Array.isArray(viewingTeam.members) ? viewingTeam.members : [],
        participatorUsernames: [user.username],
        isPrivate: true,
        teamId: viewingTeam.id,
        timestamp: Date.now()
      };

      await setDoc(doc(db, 'pins', eventId), { ...newEvent, type: 'cleanup' });
      
      await addDoc(collection(db, 'teamMessages'), {
        teamId: viewingTeam.id,
        userId: 'system',
        username: 'System',
        content: `${user.username} created an event!`,
        timestamp: Date.now(),
        isSystem: true
      });

      setShowCreateEvent(false);
      onShowNotification('Crew event scheduled!', 'success');
    } catch (err) {
      console.error('Error creating event:', err);
    }
  };

  const handleJoinEvent = async (eventId: string) => {
    try {
      await updateDoc(doc(db, 'pins', eventId), {
        participatorUsernames: arrayUnion(user.username)
      });
      onShowNotification('Joined crew event!', 'success');
    } catch (err) {
      console.error('Error joining event:', err);
    }
  };

  const handleCancelEvent = async () => {
    if (!eventToCancel || !viewingTeam) return;
    try {
      await deleteDoc(doc(db, 'pins', eventToCancel));
      
      await addDoc(collection(db, 'teamMessages'), {
        teamId: viewingTeam.id,
        userId: 'system',
        username: 'System',
        content: `${user.username} cancelled an event!`,
        timestamp: Date.now(),
        isSystem: true
      });

      onShowNotification('Event cancelled', 'success');
      setEventToCancel(null);
    } catch (err) {
      console.error('Error cancelling event:', err);
      onShowNotification('Failed to cancel event', 'error');
    }
  };

  const handleCompleteCleanup = async () => {
    if (!showCleanupReportModal) return;
    setIsCreating(true);
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

      await updateDoc(doc(db, 'pins', showCleanupReportModal.id), {
        isCompleted: true,
        attendees: finalAttendees,
        completedAt: Date.now()
      });

      // Update user scrap
      for (const attendee of finalAttendees) {
        const u = allUsers[attendee.username];
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
      setIsCreating(false);
    }
  };

  const handleRateOrganizer = async () => {
    if (!showOrganizerRatingModal) return;
    setIsCreating(true);
    try {
      const ratingObj = {
        userId: user.id,
        username: user.username,
        rating: organizerRating,
        comment: organizerComment,
        timestamp: Date.now()
      };

      await updateDoc(doc(db, 'pins', showOrganizerRatingModal.id), {
        organizerRatings: arrayUnion(ratingObj)
      });

      onShowNotification('Rating submitted!', 'success');
      setShowOrganizerRatingModal(null);
      setOrganizerComment('');
      setOrganizerRating(5);
    } catch (err) {
      console.error('Error rating organizer:', err);
      onShowNotification('Failed to submit rating', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleLeaveTeam = async () => {
    if (!user.teamId) return;

    try {
      const teamRef = doc(db, 'teams', user.teamId);
      const teamSnap = await getDoc(teamRef);
      if (teamSnap.exists()) {
        const teamData = teamSnap.data() as Team;
        const isCreator = teamData.creatorId === (user.uid || user.id);
        const memberCount = (Array.isArray(teamData.members) ? teamData.members : []).length;

        if (isCreator && memberCount > 1) {
          onShowNotification('Please transfer crew ownership before leaving.', 'error');
          setShowLeaveConfirm(false);
          return;
        } else {
          await updateDoc(teamRef, sanitizeData({
            members: arrayRemove(user.username),
            admins: arrayRemove(user.username),
            memberUids: arrayRemove(user.uid || user.id),
            adminUids: arrayRemove(user.uid || user.id)
          }));
        }
      }

      await updateDoc(doc(db, 'users', user.id), {
        teamId: deleteField(),
        teamName: deleteField(),
        teamRole: deleteField()
      });

      onUpdateUser({ ...user, teamId: undefined, teamName: undefined, teamRole: undefined });
      setViewingTeam(null);
      await fetchTeams();
      setShowLeaveConfirm(false);
      onShowNotification('You have left the team.', 'success');
    } catch (err) {
      console.error('Error leaving team:', err);
      onShowNotification('Failed to leave team.', 'error');
      setShowLeaveConfirm(false);
    }
  };

  const handleRemoveMember = async (targetUsername: string) => {
    if (!viewingTeam) return;
    try {
      const teamRef = doc(db, 'teams', viewingTeam.id);
      const targetUser = allUsers[targetUsername];
      
      const updates: any = {
        members: arrayRemove(targetUsername),
        admins: arrayRemove(targetUsername)
      };
      
      if (targetUser && targetUser.uid) {
        updates.memberUids = arrayRemove(targetUser.uid);
        updates.adminUids = arrayRemove(targetUser.uid);
      }
      
      await updateDoc(teamRef, updates);
      
      if (targetUser) {
        await updateDoc(doc(db, 'users', targetUser.id), {
          teamId: deleteField(),
          teamName: deleteField(),
          teamRole: deleteField()
        });
      }
      
      onShowNotification(`${targetUsername} removed from crew`, 'success');
    } catch (err) {
      console.error('Error removing member:', err);
      onShowNotification('Failed to remove member.', 'error');
    }
  };



  const handleTransferOwnership = async (targetUsername: string) => {
    if (!viewingTeam || !window.confirm(`Transfer ownership to ${targetUsername}? You will become Staff.`)) return;
    try {
      const teamRef = doc(db, 'teams', viewingTeam.id);
      const targetUser = allUsers[targetUsername];
      if (!targetUser || !targetUser.uid) return;

      await updateDoc(teamRef, {
        creatorId: targetUser.uid,
        creatorUsername: targetUsername,
        adminUids: arrayUnion(targetUser.uid)
      });
      
      await updateDoc(doc(db, 'users', user.id), { teamRole: 'member' });
      await updateDoc(doc(db, 'users', targetUser.id), { teamRole: 'creator' });

      onShowNotification(`Ownership transferred to ${targetUsername}`, 'success');
      setViewingTeam(prev => {
        if (!prev) return prev;
        return { 
          ...prev, 
          creatorId: targetUser.uid!, 
          creatorUsername: targetUsername,
          adminUids: Array.from(new Set([...(prev.adminUids || []), targetUser.uid!]))
        };
      });
      fetchTeams();
    } catch (err) {
      console.error('Error transferring ownership:', err);
      onShowNotification('Failed to transfer ownership', 'error');
    }
  };

  const handleInviteMember = async () => {
    if (!viewingTeam || inviteSelectedUsernames.length === 0) return;
    
    try {
      const batch = writeBatch(db);
      let invitesAdded = 0;
      
      for (const username of inviteSelectedUsernames) {
        const targetUser = allUsers[username];
        
        if (!targetUser) continue;
        
        // Fetch latest user data to ensure teamId is up-to-date
        const targetUserSnap = await getDoc(doc(db, 'users', targetUser.id));
        const latestTargetUser = targetUserSnap.exists() ? targetUserSnap.data() as UserProfile : targetUser;
        
        if (latestTargetUser.teamId) {
          const teamSnap = await getDoc(doc(db, 'teams', latestTargetUser.teamId));
          if (teamSnap.exists()) {
            onShowNotification(`${username} is already in a crew.`, 'error');
            continue;
          }
        }

        const targetUserRank = getRankInfo(targetUser.totalXP);
        if (targetUserRank.level < 3) {
          onShowNotification(`${username} must be at least Level 3 to join a crew.`, 'error');
          continue;
        }
        
        if ((targetUser.banLevel || 0) >= 1) {
          onShowNotification(`${username} is banned and cannot join a crew.`, 'error');
          continue;
        }

        const notifRef = doc(collection(db, "notifications"));
        batch.set(notifRef, {
          targetUserId: targetUser.id,
          message: `@${user.username} invited you to join their crew: ${viewingTeam.name}!`,
          timestamp: Date.now(),
          read: false,
          type: 'crew_invite',
          teamId: viewingTeam.id,
          teamName: viewingTeam.name,
          teamIcon: viewingTeam.icon || '🌍',
          teamBgColor: viewingTeam.backgroundColor || 'bg-primary',
          fromUsername: user.username
        });

        // Also add to user document for persistence and easy querying
        batch.update(doc(db, 'users', targetUser.id), {
          crewInvites: arrayUnion({
            teamId: viewingTeam.id,
            teamName: viewingTeam.name,
            teamIcon: viewingTeam.icon || '🌍',
            teamBgColor: viewingTeam.backgroundColor || 'bg-primary',
            fromUsername: user.username,
            timestamp: Date.now()
          })
        });
        invitesAdded++;
      }
      
      if (invitesAdded > 0) {
        await batch.commit();
        onShowNotification(`Invitations sent!`, 'success');
        setShowInviteModal(false);
        setInviteSelectedUsernames([]);
      }
    } catch (err) {
      console.error('Error sending invites:', err);
      onShowNotification('Failed to send invitations.', 'error');
    }
  };

  const handleDeclineInvite = async (notifId: string) => {
    try {
      const invite = pendingInvites.find(i => i.id === notifId);
      const batch = writeBatch(db);
      batch.update(doc(db, 'notifications', notifId), { read: true });
      
      if (invite && user.crewInvites) {
        const inviteToRemove = user.crewInvites.find(i => i.teamId === invite.teamId);
        if (inviteToRemove) {
          batch.update(doc(db, 'users', user.id), {
            crewInvites: arrayRemove(inviteToRemove)
          });
        }
      }
      
      await batch.commit();
      onShowNotification('Invitation declined.', 'info');
      
      if (invite && user.crewInvites) {
        onUpdateUser({
          ...user,
          crewInvites: user.crewInvites.filter(i => i.teamId !== invite.teamId)
        });
      }
    } catch (err) {
      console.error('Error declining invite:', err);
    }
  };

  const handleAcceptJoinRequest = async (username: string) => {
    if (!viewingTeam) return;
    try {
      const targetUser = allUsers[username];
      if (!targetUser) {
        onShowNotification('User not found.', 'error');
        return;
      }

      const teamRef = doc(db, 'teams', viewingTeam.id);
      await updateDoc(teamRef, {
        members: arrayUnion(username),
        joinRequests: arrayRemove(username)
      });

      await updateDoc(doc(db, 'users', targetUser.id), {
        teamId: viewingTeam.id,
        teamName: viewingTeam.name,
        teamRole: 'member'
      });

      await setDoc(doc(collection(db, "notifications")), {
        targetUserId: targetUser.id,
        message: `Your request to join ${viewingTeam.name} was accepted!`,
        timestamp: Date.now(),
        read: false,
        type: 'request_accepted'
      });

      onShowNotification(`${username} joined the crew!`, 'success');
      setViewingTeam(prev => {
        if (!prev) return prev;
        const currentMembers = Array.isArray(prev.members) ? prev.members : [];
        const currentJoinRequests = Array.isArray(prev.joinRequests) ? prev.joinRequests : [];
        return { 
          ...prev, 
          members: [...currentMembers, username],
          joinRequests: currentJoinRequests.filter(r => r !== username)
        };
      });
      fetchTeams();
    } catch (err) {
      console.error('Error accepting request:', err);
      onShowNotification('Failed to accept request.', 'error');
    }
  };

  const handleDeclineJoinRequest = async (username: string) => {
    if (!viewingTeam) return;
    try {
      const teamRef = doc(db, 'teams', viewingTeam.id);
      await updateDoc(teamRef, {
        joinRequests: arrayRemove(username)
      });

      const targetUser = allUsers[username];
      if (targetUser) {
        await setDoc(doc(collection(db, "notifications")), {
          targetUserId: targetUser.id,
          message: `Your request to join ${viewingTeam.name} was declined.`,
          timestamp: Date.now(),
          read: false,
          type: 'request_declined'
        });
      }

      onShowNotification('Request declined.', 'info');
      setViewingTeam(prev => {
        if (!prev) return prev;
        const currentJoinRequests = Array.isArray(prev.joinRequests) ? prev.joinRequests : [];
        return { 
          ...prev, 
          joinRequests: currentJoinRequests.filter(r => r !== username)
        };
      });
      fetchTeams();
    } catch (err) {
      console.error('Error declining request:', err);
    }
  };

  const handleUpdateRole = async (targetUsername: string, newRole: 'Staff' | 'Member') => {
    if (!viewingTeam) return;
    try {
      const teamRef = doc(db, 'teams', viewingTeam.id);
      const targetUser = allUsers[targetUsername];
      
      const updates: any = {};
      if (newRole === 'Staff') {
        updates.admins = arrayUnion(targetUsername);
        if (targetUser && targetUser.uid) {
          updates.adminUids = arrayUnion(targetUser.uid);
        }
      } else {
        updates.admins = arrayRemove(targetUsername);
        if (targetUser && targetUser.uid) {
          updates.adminUids = arrayRemove(targetUser.uid);
        }
      }
      
      await updateDoc(teamRef, updates);
      
      if (targetUser) {
        await updateDoc(doc(db, 'users', targetUser.id), {
          teamRole: newRole === 'Staff' ? 'admin' : 'member'
        });
      }
      
      onShowNotification(`${targetUsername} is now ${newRole}`, 'success');
      setViewingTeam(prev => {
        if (!prev) return prev;
        const currentAdmins = Array.isArray(prev.admins) ? prev.admins : [];
        const currentAdminUids = Array.isArray(prev.adminUids) ? prev.adminUids : [];
        
        const newAdmins = newRole === 'Staff' 
          ? [...currentAdmins, targetUsername]
          : currentAdmins.filter(a => a !== targetUsername);
          
        const newAdminUids = targetUser && targetUser.uid
          ? (newRole === 'Staff' 
              ? [...currentAdminUids, targetUser.uid]
              : currentAdminUids.filter(a => a !== targetUser.uid))
          : currentAdminUids;

        return { ...prev, admins: newAdmins, adminUids: newAdminUids };
      });
      fetchTeams();
    } catch (err) {
      console.error('Error updating role:', err);
      onShowNotification('Failed to update role', 'error');
    }
  };

  const invitedTeamIds = useMemo(() => {
    const fromNotifs = (Array.isArray(pendingInvites) ? pendingInvites : []).map(i => i.teamId);
    const fromUserInvites = (Array.isArray(user.crewInvites) ? user.crewInvites : [])
      .filter(i => Date.now() - (i.timestamp || 0) < 7 * 24 * 60 * 60 * 1000)
      .map(i => i.teamId);
    return Array.from(new Set([...fromNotifs, ...fromUserInvites]));
  }, [pendingInvites, user.crewInvites]);

  const filteredTeams = (Array.isArray(teams) ? teams : []).filter(t => {
    if (!t) return false;
    // Private crews are invite only and should not appear in the crew search
    // unless invited or already a member
    if (t.isPrivate && !(Array.isArray(invitedTeamIds) ? invitedTeamIds : []).includes(t.id) && user.teamId !== t.id) return false;
    
    const matchesSearch = (t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (t.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    // If user is already in a team, they can see it regardless of restrictions
    if (user.teamId === t.id) return matchesSearch;

    // If invited, bypass region and minXP restrictions
    if ((Array.isArray(invitedTeamIds) ? invitedTeamIds : []).includes(t.id)) return matchesSearch;

    // Filter by region if the team has one
    if (t.region && user.region && t.region.toLowerCase() !== user.region.toLowerCase()) {
      return false;
    }

    // Filter by distance (50 miles = 80467 meters)
    if (userLocation && t.lat && t.lng) {
      const distance = calculateDistance(userLocation.lat, userLocation.lng, t.lat, t.lng);
      if (distance > 80467) return false;
    }

    // Filter by minXP
    if (t.minXp && user.totalXP < t.minXp) {
      return false;
    }

    return matchesSearch;
  });

  const currentRank = getRankInfo(user.totalXP);
  const hasTeam = !!user.teamId && teams.some(t => t.id === user.teamId);

  if (currentRank.level < 3) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-black animate-in slide-in-from-right duration-300">
        <div className="pt-safe p-4 flex items-center justify-between bg-white dark:bg-gray-900 border-b dark:border-gray-800">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Cleanup Crews</h1>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">Locked</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center pb-24">
          <div className="w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
            <Lock size={40} className="text-gray-400" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-2">Locked Feature</h2>
          <p className="text-sm font-bold text-gray-500 mb-8 max-w-xs">Cleanup Crews unlock at Level 3. Keep cleaning up to level up and join a crew!</p>
          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border dark:border-gray-800 w-full max-w-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Current Level</span>
              <span className="text-xs font-black text-primary uppercase tracking-widest">Level {currentRank.level}</span>
            </div>
            <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-1000"
                style={{ width: `${(currentRank.level / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if ((user.teamId || initialTeamId) && !viewingTeam && loading) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-black items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
        <p className="mt-4 text-sm font-bold text-gray-500 uppercase tracking-widest">Loading crew details...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-black animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="pt-safe p-4 flex items-center justify-between bg-white dark:bg-gray-900 border-b dark:border-gray-800">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Cleanup Crews</h1>
            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Collaborate & Compete</p>
          </div>
        </div>
        {!hasTeam && (
          <button 
            onClick={() => {
              if (currentRank.level >= 4) {
                setShowCreateModal(true);
              } else {
                onShowNotification('Crew creation unlocks at Level 4!', 'error');
              }
            }}
            className={`p-3 rounded-2xl shadow-lg active:scale-95 transition-all ${currentRank.level >= 4 ? 'bg-primary text-white shadow-primary/20' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'}`}
          >
            {currentRank.level >= 4 ? <Plus size={20} /> : <Lock size={20} />}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Search crews..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl py-4 pl-12 pr-10 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 active:scale-90 transition-all"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-10">
        {hasTeam && (
          <div className="mb-8">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Your Team</p>
            {teams.filter(t => t.id === user.teamId).map(team => (
              <div key={team.id} className="bg-primary text-white p-6 rounded-[2.5rem] shadow-xl shadow-primary/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${team.backgroundColor || 'bg-white/20'} backdrop-blur-sm`}>
                        {team.icon || '🌍'}
                      </div>
                      <div>
                        <h2 className="text-xl font-black uppercase tracking-tighter">{team.name}</h2>
                        <p className="text-[10px] font-bold opacity-70">{(Array.isArray(team.members) ? team.members : []).length} Members • {team.region || 'Global'}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowLeaveConfirm(true)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                    >
                      <LogOut size={18} />
                    </button>
                  </div>
                  <p className="text-sm opacity-90 mb-6 line-clamp-2">{team.description}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-secondary" />
                      <span className="text-xs font-black uppercase tracking-widest">{(Array.isArray(team.members) ? team.members : []).length} Members</span>
                    </div>
                    <button 
                      onClick={() => {
                        setViewingTeam(team);
                        setViewingTab('overview');
                      }}
                      className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      View Crew <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {pendingInvites.length > 0 && !hasTeam && (
          <div className="mb-8">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Pending Invitations</p>
            <div className="grid gap-4">
              {pendingInvites.map(invite => (
                <div key={invite.id} className="bg-white dark:bg-gray-900 p-5 rounded-3xl border dark:border-gray-800 flex flex-col gap-4 shadow-lg shadow-primary/5">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${invite.teamBgColor || 'bg-primary/10 text-primary'}`}>
                      {invite.teamIcon || '🌍'}
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{invite.teamName}</h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Invited by @{invite.fromUsername}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const team = teams.find(t => t.id === invite.teamId);
                        if (team) {
                          setViewingTeam(team);
                          setViewingTab('overview');
                        } else {
                          onShowNotification('Crew details loading...', 'info');
                        }
                      }}
                      className="flex-1 bg-primary text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-primary/20"
                    >
                      View Crew
                    </button>
                    <button 
                      onClick={() => handleDeclineInvite(invite.id)}
                      className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-500 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasTeam && currentRank.level >= 4 && (
          <div className="mb-8">
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 dark:from-primary/10 dark:to-transparent border border-primary/20 p-6 rounded-3xl flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                <Users size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-2">Start Your Legacy</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Create your own cleanup crew, invite friends, and compete on the leaderboards.</p>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Create Cleanup Crew
              </button>
            </div>
          </div>
        )}

        {!hasTeam && (
          <>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Explore Cleanup Crews</p>
            <div className="grid gap-4">
              {filteredTeams.filter(t => t.id !== (hasTeam ? user.teamId : null)).map(team => {
                const isInvited = pendingInvites.some(i => i.teamId === team.id);
                return (
                  <div 
                    key={team.id} 
                    onClick={() => {
                      setViewingTeam(team);
                      setViewingTab('overview');
                    }}
                    className={`bg-white dark:bg-gray-900 p-5 rounded-3xl border dark:border-gray-800 flex items-center justify-between group hover:border-primary/30 transition-all cursor-pointer ${isInvited ? 'border-primary border-2 shadow-lg shadow-primary/20 animate-pulse-subtle' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${team.backgroundColor || 'bg-gray-100 dark:bg-gray-800'}`}>
                        {team.icon || '🌍'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{team.name}</h3>
                          {team.isPrivate ? <Lock size={12} className="text-gray-400" /> : <Globe size={12} className="text-emerald-500" />}
                          {isInvited && <span className="text-[8px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-md uppercase tracking-widest">Invited</span>}
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {(Array.isArray(team.members) ? team.members : []).length} Members
                        </p>
                      </div>
                    </div>
                    {!hasTeam && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinTeam(team);
                        }}
                        className="bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all active:scale-95"
                      >
                        {isInvited ? 'Accept' : (team.isPrivate ? 'Request' : 'Join')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="absolute inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-[3rem] sm:rounded-[3rem] p-8 max-h-[90vh] overflow-y-auto hide-scrollbar pb-24"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Found a Crew</h2>
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Start your legacy</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Crew Icon & Color</label>
                  <div className="flex flex-col gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                    <div className="flex items-center justify-center mb-2">
                      <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-lg ${newTeamBgColor}`}>
                        {newTeamIcon}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Select Icon</p>
                      <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
                        {CREW_ICONS.map(icon => (
                          <button
                            key={icon}
                            onClick={() => setNewTeamIcon(icon)}
                            className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${newTeamIcon === icon ? 'bg-white dark:bg-gray-700 shadow-md scale-110' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Select Color</p>
                      <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
                        {CREW_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => setNewTeamBgColor(color)}
                            className={`flex-shrink-0 w-8 h-8 rounded-full transition-all ${color} ${newTeamBgColor === color ? 'ring-4 ring-white dark:ring-gray-900 shadow-lg scale-110' : 'opacity-70 hover:opacity-100'}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Crew Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. The Litter Legends"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div className="space-y-2 relative">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Region (City)</label>
                  <input 
                    type="text"
                    placeholder="Search city/region..."
                    value={regionSearchQuery || newTeamRegion}
                    onChange={(e) => {
                      setRegionSearchQuery(e.target.value);
                      if (e.target.value !== newTeamRegion) setNewTeamRegion('');
                    }}
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  {isSearchingRegion && (
                    <div className="absolute right-4 top-[2.2rem] text-primary">
                      <Loader2 size={18} className="animate-spin" />
                    </div>
                  )}
                  {regionResults.length > 0 && !newTeamRegion && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-h-48 overflow-y-auto border dark:border-gray-700">
                      {regionResults.map(res => (
                        <div 
                          key={res.place_id} 
                          className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm font-bold border-b dark:border-gray-700 last:border-b-0"
                          onClick={() => {
                            setNewTeamRegionLat(parseFloat(res.lat));
                            setNewTeamRegionLng(parseFloat(res.lon));
                            setNewTeamRegion(res.display_name.split(',')[0]);
                            setRegionSearchQuery('');
                            setRegionResults([]);
                          }}
                        >
                          {res.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Description</label>
                  <textarea 
                    placeholder="What's your crew about?"
                    value={newTeamDesc}
                    onChange={(e) => setNewTeamDesc(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all h-32 resize-none"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isPrivate ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      {isPrivate ? <Lock size={18} /> : <Globe size={18} />}
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{isPrivate ? 'Private Crew' : 'Public Crew'}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{isPrivate ? 'Requires approval' : 'Anyone can join'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${isPrivate ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isPrivate ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {!isPrivate && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Max Size (2-50)</label>
                      <input 
                        type="number"
                        min="2"
                        max="50"
                        value={Number.isNaN(maxSize) ? '' : maxSize}
                        onChange={(e) => setMaxSize(parseInt(e.target.value, 10))}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Min XP Required</label>
                      <input 
                        type="number"
                        min="0"
                        value={Number.isNaN(newTeamMinXp) ? '' : newTeamMinXp}
                        onChange={(e) => setNewTeamMinXp(parseInt(e.target.value, 10))}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Characteristics (Max 10)</label>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                    {CREW_CHARACTERISTICS.map(char => {
                      const isSelected = (Array.isArray(selectedCharacteristics) ? selectedCharacteristics : []).includes(char);
                      return (
                        <button
                          key={char}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCharacteristics(prev => prev.filter(c => c !== char));
                            } else if (selectedCharacteristics.length < 10) {
                              setSelectedCharacteristics(prev => [...prev, char]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isSelected ? 'bg-primary text-white' : 'bg-white dark:bg-gray-700 text-gray-400'}`}
                        >
                          {char}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button 
                  onClick={handleCreateTeam}
                  disabled={!newTeamName.trim() || isCreating}
                  className="w-full bg-primary text-white font-black py-5 rounded-2xl uppercase text-xs tracking-[0.2em] shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                >
                  {isCreating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  Found Crew
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* View Crew Details Overlay */}
      <AnimatePresence>
        {viewingTeam && (
          <div className="absolute inset-0 z-[400] bg-gray-50 dark:bg-black flex flex-col">
            {/* Header */}
            <div className="pt-safe p-4 flex items-center justify-between bg-white dark:bg-gray-900 border-b dark:border-gray-800">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    if (user.teamId === viewingTeam.id) {
                      onBack();
                    } else {
                      setViewingTeam(null);
                    }
                  }} 
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                >
                  <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
                </button>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-2xl shadow-sm ${viewingTeam.backgroundColor || 'bg-gray-100 dark:bg-gray-800'}`}>
                    {viewingTeam.icon || '🌍'}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">{viewingTeam.name}</h2>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Cleanup Crew</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 bg-primary/10 rounded-full">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">{viewingTeam.isPrivate ? 'Private' : 'Public'}</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b dark:border-gray-800 bg-white dark:bg-gray-900">
              {(user.teamId === viewingTeam.id ? ['overview', 'events', 'chat', 'compete'] : ['overview', 'compete'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setViewingTab(tab as any)}
                  className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${viewingTab === tab ? 'text-primary' : 'text-gray-400'}`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {tab}
                  </span>
                  {viewingTab === tab && (
                    <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className={`flex-1 ${viewingTab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto pb-10'}`}>
              {viewingTab === 'compete' && (
                <div className="p-6 space-y-4">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Territory Control</h3>
                  <div className="h-64 w-full rounded-2xl overflow-hidden relative">
                    <MapContainer 
                      center={viewingTeam?.lat && viewingTeam?.lng ? [viewingTeam.lat, viewingTeam.lng] : [user.lat || 37.7749, user.lng || -122.4194]} 
                      zoom={10} 
                      className="h-full w-full"
                      dragging={true}
                      zoomControl={true}
                      scrollWheelZoom={true}
                      doubleClickZoom={true}
                      boxZoom={true}
                      keyboard={true}
                      ref={mapRef}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <AutoLocateHandler teamLocation={viewingTeam?.lat && viewingTeam?.lng ? { lat: viewingTeam.lat, lng: viewingTeam.lng } : undefined} />
                      <ZoomToUserButton centerOnMe={centerOnMe} />
                    </MapContainer>
                  </div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mt-6">Rankings</h3>
                  {teams.sort((a, b) => (b.litterStats?.piecesCount || 0) - (a.litterStats?.piecesCount || 0)).map((team, index) => (
                    <div key={team.id} onClick={() => setViewingTeam(team)} className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer ${team.id === viewingTeam?.id ? 'bg-primary/10 border border-primary' : 'bg-white dark:bg-gray-900 border dark:border-gray-800'}`}>
                      <div className="w-8 h-8 flex items-center justify-center font-black text-gray-400 rounded-full border-2" style={{ borderColor: team.competitionColor || '#9ca3af' }}>#{index + 1}</div>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-2xl shadow-sm ${team.backgroundColor || 'bg-gray-100 dark:bg-gray-800'}`}>
                        {team.icon || '🌍'}
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-gray-900 dark:text-white">{team.name}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {((team.litterStats?.piecesCount || 0) / 1000 * 100).toFixed(1)}% Captured
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {viewingTab === 'overview' && (
                <div className="p-6 space-y-8">
                  <div className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border dark:border-gray-800 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">About Crew</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{viewingTeam.description}</p>
                    
                    {viewingTeam.region && (
                      <div className="mt-4 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <MapPin size={14} />
                        <span className="text-xs font-bold">{viewingTeam.region}</span>
                      </div>
                    )}

                    <div className="mt-6 flex flex-wrap gap-2">
                      {(viewingTeam.characteristics || []).map(char => (
                        <span key={char} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                          {char}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border dark:border-gray-800 shadow-sm overflow-hidden">
                    <button 
                      onClick={() => setShowMembers(!showMembers)}
                      className="w-full p-6 flex items-center justify-between"
                    >
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Crew Members ({(Array.isArray(viewingTeam.members) ? viewingTeam.members : []).length})</p>
                      {showMembers ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </button>
                    
                    {showMembers && (
                      <div className="px-6 pb-6 space-y-4">
                        {(viewingTeam.creatorId === user.id || (Array.isArray(viewingTeam.admins) ? viewingTeam.admins : []).includes(user.username)) && (
                          <button 
                            onClick={() => setShowInviteModal(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                          >
                            <UserPlus size={14} /> Invite
                          </button>
                        )}
                        {(() => {
                          let membersList = Array.isArray(viewingTeam.members) ? [...viewingTeam.members] : [];
                          if (viewingTeam.creatorUsername && !(Array.isArray(membersList) ? membersList : []).includes(viewingTeam.creatorUsername)) {
                            membersList.unshift(viewingTeam.creatorUsername);
                          }
                          
                          return membersList.map(username => {
                            const isFounder = viewingTeam.creatorUsername === user.username;
                            const isStaff = (Array.isArray(viewingTeam.admins) ? viewingTeam.admins : []).includes(user.username);
                            const targetIsFounder = viewingTeam.creatorUsername === username;
                            const targetIsStaff = (Array.isArray(viewingTeam.admins) ? viewingTeam.admins : []).includes(username);
                            const canEditTarget = (isFounder && !targetIsFounder) || (isStaff && !targetIsFounder && !targetIsStaff);
                            const targetUser = allUsers[username];

                            return (
                              <div key={username} className="w-full bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border dark:border-gray-700 flex items-center justify-between group hover:border-primary/30 transition-all">
                                <button 
                                  onClick={() => targetUser && onViewProfile(targetUser.id)}
                                  className="flex items-center gap-3 flex-1 text-left"
                                >
                                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-gray-400 overflow-hidden shrink-0">
                                    {targetUser?.profilePicture ? (
                                      <img src={targetUser.profilePicture} alt={username} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <Users size={20} />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{username}</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                      {targetIsFounder ? 'Founder' : targetIsStaff ? 'Staff' : 'Member'}
                                    </p>
                                  </div>
                                </button>
                                
                                <div className="flex items-center gap-0.5">
                                  {canEditTarget && (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPendingAction({ type: targetIsStaff ? 'demote' : 'promote', username });
                                        }}
                                        className={`p-2 rounded-xl transition-all ${targetIsStaff ? 'text-gray-400 hover:text-red-500' : 'text-primary hover:text-primary/80'}`}
                                        title={targetIsStaff ? 'Demote' : 'Promote'}
                                      >
                                        {targetIsStaff ? <Shield size={18} /> : <ShieldCheck size={18} />}
                                      </button>
                                      {viewingTeam.creatorId === user.id && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setPendingAction({ type: 'transfer', username });
                                          }}
                                          className="p-2 rounded-xl text-primary hover:text-primary/80 transition-all"
                                          title="Transfer Ownership"
                                        >
                                          <Users size={18} />
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPendingAction({ type: 'remove', username });
                                        }}
                                        className="p-2 rounded-xl text-red-500 hover:text-red-600 transition-all"
                                        title="Remove"
                                      >
                                        <Trash2 size={18} />
                                      </button>
                                    </>
                                  )}
                                  <button onClick={() => targetUser && onViewProfile(targetUser.id)} className="p-2">
                                    <ChevronRight size={16} className="text-gray-400 group-hover:text-primary transition-colors" />
                                  </button>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border dark:border-gray-800">
                      <Users className="text-primary mb-2" size={20} />
                      <p className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">{(Array.isArray(viewingTeam.members) ? viewingTeam.members : []).length}</p>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Members</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border dark:border-gray-800">
                      <Trophy className="text-secondary mb-2" size={20} />
                      <p className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">{new Date(viewingTeam.joinedAt).toLocaleDateString()}</p>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Founded</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border dark:border-gray-800">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Crew Stats</p>
                    <div className="space-y-4">
                      {viewingTeam.litterStats && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Total Weight</span>
                            <span className="text-xs font-black uppercase tracking-widest text-primary">{convertWeight(viewingTeam.litterStats.weightKg, user.measurementSystem).toFixed(1)} {getWeightUnit(user.measurementSystem)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Total Area</span>
                            <span className="text-xs font-black uppercase tracking-widest text-primary">{convertArea(viewingTeam.litterStats.areaSqM, user.measurementSystem).toFixed(1)} {getAreaUnit(user.measurementSystem)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Pieces Collected</span>
                            <span className="text-xs font-black uppercase tracking-widest text-primary">{viewingTeam.litterStats.piecesCount}</span>
                          </div>
                          <div className="h-px bg-gray-100 dark:bg-gray-800 my-2" />
                        </>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Visibility</span>
                        <span className="text-xs font-black uppercase tracking-widest text-primary">{viewingTeam.isPrivate ? 'Private' : 'Public'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Founded</span>
                        <span className="text-xs font-black uppercase tracking-widest text-primary">{new Date(viewingTeam.joinedAt).toLocaleDateString()}</span>
                      </div>
                      {user.teamId === viewingTeam.id ? (
                        <button 
                          onClick={() => setShowLeaveConfirm(true)}
                          className="w-full bg-red-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all mt-4"
                        >
                          Leave Crew
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleJoinTeam(viewingTeam)}
                          className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all mt-4 shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                        >
                          <UserPlus size={14} />
                          Join Crew
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Removed members tab content */}

              {viewingTab === 'events' && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Scheduled Cleanups</p>
                    {(viewingTeam.creatorId === user.id || (Array.isArray(viewingTeam.admins) ? viewingTeam.admins : []).includes(user.username)) && (
                      <button 
                        onClick={() => setShowCreateEvent(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                      >
                        <Plus size={14} /> Schedule
                      </button>
                    )}
                  </div>

                  {teamEvents.length === 0 ? (
                    <div className="text-center py-12">
                      <Calendar size={48} className="mx-auto text-gray-200 dark:text-gray-800 mb-4" />
                      <p className="text-sm font-bold text-gray-400">No events scheduled yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(teamEvents || []).map(event => (
                        <div key={event.id} className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border dark:border-gray-800">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">{event.title}</h3>
                            <div className="flex items-center gap-2">
                              {event.isCompleted && (
                                <div className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[8px] font-black uppercase tracking-widest">Completed</div>
                              )}
                              <div className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[8px] font-black uppercase tracking-widest">Crew Only</div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{event.description}</p>
                          
                          {/* Attendee List */}
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Attendees ({(event.participatorUsernames || []).length})</p>
                              {event.isCompleted && (event.organizerRatings || []).length > 0 && (
                                <div className="flex items-center gap-1 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                                  <Star size={10} fill="currentColor" />
                                  {(event.organizerRatings!.reduce((acc, r) => acc + r.rating, 0) / event.organizerRatings!.length).toFixed(1)} ({(event.organizerRatings || []).length})
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(event.participatorUsernames || []).map(uname => (
                                <span key={uname} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[8px] font-bold text-gray-600 dark:text-gray-400">@{uname}</span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t dark:border-gray-800">
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Starts</span>
                                <span className="text-xs font-bold text-gray-900 dark:text-white">{new Date(event.startTime).toLocaleString()}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ends</span>
                                <span className="text-xs font-bold text-gray-900 dark:text-white">{new Date(event.endTime).toLocaleString()}</span>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-2">
                              {event.creatorId === user.id && !event.isCompleted && (
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => setEventToCancel(event.id)}
                                    className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                                  >
                                    Cancel
                                  </button>
                                  {Date.now() > event.endTime && (
                                    <button 
                                      onClick={() => setShowCleanupReportModal(event)}
                                      className="px-3 py-1.5 bg-secondary text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                                    >
                                      Finalize
                                    </button>
                                  )}
                                </div>
                              )}

                              {!event.isCompleted && (
                                (event.participatorUsernames || []).includes(user.username) ? (
                                  <div className="flex items-center gap-1 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                                    <CheckCircle2 size={14} /> Attending
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => handleJoinEvent(event.id)}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                                  >
                                    Join
                                  </button>
                                )
                              )}

                              {event.isCompleted && (event.participatorUsernames || []).includes(user.username) && event.creatorId !== user.id && (
                                <button 
                                  onClick={() => setShowOrganizerRatingModal(event)}
                                  className="px-3 py-1.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                                >
                                  { (event.organizerRatings || []).some(r => r.userId === user.id) ? 'Rated' : 'Rate Organizer' }
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {viewingTab === 'chat' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {(teamMessages || []).length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare size={48} className="mx-auto text-gray-200 dark:text-gray-800 mb-4" />
                        <p className="text-sm font-bold text-gray-400">Start the conversation!</p>
                      </div>
                    ) : (
                      (teamMessages || []).map(msg => {
                        if (msg.isSystem) {
                          return (
                            <div key={msg.id} className="flex justify-center my-2">
                              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                                {msg.content}
                              </span>
                            </div>
                          );
                        }
                        const isMe = msg.userId === user.id;
                        return (
                          <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group hover-show`}>
                            <span className={`text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 ${isMe ? 'mr-2' : 'ml-2'}`}>{msg.username}</span>
                            <div className={`flex flex-col gap-1 max-w-[80%]`}>
                              {editingMessageId === msg.id ? (
                                <div className={`p-4 rounded-2xl text-sm font-bold bg-white dark:bg-gray-900 border dark:border-gray-800 text-gray-900 dark:text-white`}>
                                  <input 
                                    type="text" 
                                    className="w-full bg-transparent outline-none border-b border-gray-300 dark:border-gray-700 py-1"
                                    value={editMessageContent}
                                    onChange={(e) => setEditMessageContent(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleUpdateMessage(msg.id);
                                      if (e.key === 'Escape') setEditingMessageId(null);
                                    }}
                                  />
                                  <div className="flex gap-2 justify-end mt-2">
                                    <button onClick={() => setEditingMessageId(null)} className="text-[10px] uppercase font-bold text-gray-400">Cancel</button>
                                    <button onClick={() => handleUpdateMessage(msg.id)} className="text-[10px] uppercase font-black text-primary">Save</button>
                                  </div>
                                </div>
                              ) : (
                                <div className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                  <div className={`p-4 rounded-2xl text-sm font-bold ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-gray-900 border dark:border-gray-800 text-gray-900 dark:text-white rounded-tl-none'}`}>
                                    {msg.imageUrl && (
                                      <img src={msg.imageUrl} alt="Attachment" className="w-full h-auto rounded-xl mb-2 border border-white/20" />
                                    )}
                                    {msg.content}
                                    {msg.linkedPinId && (
                                      <button 
                                        onClick={() => {
                                          const pin = pins.find(p => p.id === msg.linkedPinId);
                                          if (pin && pin.status !== 'cleaned') {
                                            onViewPin(msg.linkedPinId!);
                                          } else {
                                            onShowNotification("This pin is no longer active or available.", "error");
                                          }
                                        }}
                                        className={`mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all w-full justify-center ${pins.some(p => p.id === msg.linkedPinId && p.status !== 'cleaned') ? (isMe ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white') : 'bg-gray-400 text-white cursor-not-allowed'}`}
                                      >
                                        <MapPin size={12} /> View Pin
                                      </button>
                                    )}
                                  </div>
                                  {isMe && (
                                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => { setEditingMessageId(msg.id); setEditMessageContent(msg.content); }} className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 hover:text-primary transition-colors">
                                        <Icons.Edit2 size={12} />
                                      </button>
                                      <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-full text-red-500 hover:text-red-400 transition-colors">
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                              <span className={`text-[8px] font-bold text-gray-400 mt-0.5 ${isMe ? 'text-right mr-2' : 'ml-2'}`}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-4 pb-20 bg-white dark:bg-gray-900 border-t dark:border-gray-800">
                    {chatImage && (
                      <div className="mb-2 relative w-16 h-16 rounded-xl overflow-hidden border">
                        <img src={chatImage} alt="Attachment" className="w-full h-full object-cover" />
                        <button onClick={() => setChatImage(null)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5"><X size={10} /></button>
                      </div>
                    )}
                    <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 w-full">
                      <button type="button" onClick={() => chatFileInputRef.current?.click()} className="flex-shrink-0 p-0 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-xl hover:text-primary transition-colors flex items-center justify-center w-9 h-9"><ImageIcon size={18} /></button>
                      <div className="flex-shrink-0 flex items-center justify-center w-9 h-9">
                        <UserTagPicker
                          allUsers={allUsers}
                          currentUser={user}
                          selectedUsernames={chatTaggedUsernames}
                          onToggleUser={u => setChatTaggedUsernames(prev => (Array.isArray(prev) ? prev : []).includes(u) ? prev.filter(x => x !== u) : [...(Array.isArray(prev) ? prev : []), u])}
                          variant="icon"
                          buddyIds={user.friends}
                          triggerIcon={<AtSign size={18} className="text-gray-500" />}
                        />
                      </div>
                      <button type="button" onClick={() => setShowChatPinSelector(true)} className="flex-shrink-0 p-0 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-xl hover:text-primary transition-colors flex items-center justify-center w-9 h-9"><MapPin size={18} /></button>

                      <PinTagPicker
                        isOpen={showChatPinSelector}
                        onClose={() => setShowChatPinSelector(false)}
                        onSelectPin={(pinId) => setChatLinkedPinId(pinId)}
                      />
                      <input 
                        type="file" 
                        ref={chatFileInputRef} 
                        onChange={e => { 
                          const f = e.target.files?.[0]; 
                          if (f) { 
                            const r = new FileReader(); 
                            r.onloadend = async () => {
                              const compressed = await compressImage(r.result as string);
                              setChatImage(compressed);
                            }; 
                            r.readAsDataURL(f); 
                          } 
                        }} 
                        className="hidden" 
                        accept="image/*" 
                      />
                      <input 
                        type="text"
                        placeholder="Message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all h-9"
                      />
                      <button 
                        type="submit"
                        disabled={!newMessage.trim() && !chatImage}
                        className="flex-shrink-0 p-0 bg-primary text-white rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center w-9 h-9 ml-0.5"
                      >
                        <Send size={16} />
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Event Modal */}
      <AnimatePresence>
        {showCreateEvent && (
          <div className="absolute inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-[3rem] sm:rounded-[3rem] p-8 pb-24"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Schedule Crew Event</h2>
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Private Cleanup</p>
                </div>
                <button onClick={() => setShowCreateEvent(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Event Title</label>
                  <input 
                    name="title"
                    required
                    placeholder="e.g. Weekend Park Sweep"
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Description</label>
                  <textarea 
                    name="description"
                    required
                    placeholder="Details about the cleanup..."
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all h-24 resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Start Time</label>
                  <input 
                    name="startTime"
                    type="datetime-local"
                    required
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">End Time</label>
                  <input 
                    name="endTime"
                    type="datetime-local"
                    required
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-primary text-white font-black py-5 rounded-2xl uppercase text-xs tracking-[0.2em] shadow-xl shadow-primary/20 active:scale-95 transition-all"
                >
                  Schedule Event
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cleanup Report Modal */}
      <AnimatePresence>
        {showCleanupReportModal && (
          <div className="fixed inset-0 bg-black/80 z-[6000] flex items-center justify-center p-6 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-[3rem] p-8 shadow-2xl w-full max-w-md border dark:border-gray-800 max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Cleanup Report</h3>
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Finalize Event</p>
                </div>
                <button onClick={() => setShowCleanupReportModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
              
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-6 shrink-0">Rate the efficiency of participants to award Scrap rewards.</p>
              
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 hide-scrollbar">
                {(showCleanupReportModal.participatorUsernames || []).map(username => {
                  const attendee = cleanupAttendees.find(a => a.username === username) || { username, efficiency: 100 };
                  return (
                    <div key={username} className="bg-gray-50 dark:bg-gray-800 p-6 rounded-[2rem] border dark:border-gray-700">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-tight">@{username}</span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          <span>Efficiency</span>
                          <span className="text-primary">{attendee.efficiency}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" max="100" 
                          step="10"
                          value={attendee.efficiency}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setCleanupAttendees(prev => {
                              const existing = prev.find(p => p.username === username);
                              if (existing) return prev.map(p => p.username === username ? { ...p, efficiency: val } : p);
                              return [...prev, { username, efficiency: val }];
                            });
                          }}
                          className="w-full accent-primary h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-6 border-t dark:border-gray-800 shrink-0">
                <button 
                  onClick={handleCompleteCleanup}
                  disabled={isCreating}
                  className="w-full bg-primary text-white font-black py-5 rounded-2xl uppercase text-xs tracking-[0.2em] shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isCreating ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Complete Cleanup</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Organizer Rating Modal */}
      <AnimatePresence>
        {showOrganizerRatingModal && (
          <div className="fixed inset-0 bg-black/80 z-[6000] flex items-center justify-center p-6 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-[3rem] p-8 shadow-2xl w-full max-w-md border dark:border-gray-800"
            >
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
                  disabled={isCreating || (showOrganizerRatingModal.organizerRatings || []).some(r => r.userId === user.id)}
                  className="w-full bg-primary text-white font-black py-5 rounded-2xl uppercase text-xs tracking-[0.2em] shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isCreating ? <Loader2 size={18} className="animate-spin" /> : 'Submit Rating'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <UserTagPicker
        allUsers={allUsers}
        currentUser={user}
        selectedUsernames={inviteSelectedUsernames}
        onToggleUser={handleToggleInviteUser}
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSend={handleInviteMember}
        buddyIds={user.friends}
        variant="hidden"
      />

      <ConfirmModal
        isOpen={showLeaveConfirm}
        onCancel={() => setShowLeaveConfirm(false)}
        onConfirm={handleLeaveTeam}
        title="Leave Crew"
        message="Are you sure you want to leave this crew? You will lose access to crew events and chat."
        confirmText="Leave Crew"
        isDestructive={true}
      />

      <ConfirmModal
        isOpen={!!pendingAction}
        title={
          pendingAction?.type === 'remove' ? 'Remove Member' : 
          pendingAction?.type === 'promote' ? 'Promote Member' : 
          pendingAction?.type === 'transfer' ? 'Transfer Ownership' :
          'Demote Member'
        }
        message={
          pendingAction?.type === 'transfer' 
            ? `Are you sure you want to transfer ownership to ${pendingAction?.username}? You will become a regular member.`
            : `Are you sure you want to ${pendingAction?.type} ${pendingAction?.username}?`
        }
        onConfirm={() => {
          if (pendingAction) {
            if (pendingAction.type === 'remove') {
              handleRemoveMember(pendingAction.username);
            } else if (pendingAction.type === 'transfer') {
              handleTransferOwnership(pendingAction.username);
            } else {
              handleUpdateRole(pendingAction.username, pendingAction.type === 'promote' ? 'Staff' : 'Member');
            }
            setPendingAction(null);
          }
        }}
        onCancel={() => setPendingAction(null)}
        isDestructive={pendingAction?.type === 'remove' || pendingAction?.type === 'transfer'}
        confirmText={pendingAction?.type === 'transfer' ? 'Transfer' : 'Confirm'}
      />

      <ConfirmModal
        isOpen={!!teamToJoin}
        onCancel={() => { setTeamToJoin(null); setNotifIdToJoin(null); }}
        onConfirm={confirmJoinTeam}
        title="Join Crew"
        message={`Are you sure you want to join ${teamToJoin?.name}? You can only be in one crew at a time.`}
        confirmText="Join Crew"
        isDestructive={false}
      />

      <ConfirmModal
        isOpen={!!eventToCancel}
        title="Cancel Event"
        message="Are you sure you want to cancel this event?"
        onConfirm={handleCancelEvent}
        onCancel={() => setEventToCancel(null)}
        isDestructive={true}
        confirmText="Cancel Event"
      />
    </div>
  );
};
