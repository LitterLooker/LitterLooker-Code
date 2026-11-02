import { db } from './firebase';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, query, orderBy, writeBatch, deleteDoc, where } from 'firebase/firestore';
import { Team, UserProfile } from '../types';

export const cleanupOldReports = async () => {
  try {
    const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    const oldReportsQuery = query(
      collection(db, "moderation"),
      where("status", "==", "resolved")
    );
    const snapshot = await getDocs(oldReportsQuery);
    
    if (!snapshot.empty) {
      let batches = [writeBatch(db)];
      let currentBatchIndex = 0;
      let operationCount = 0;
      let deleteCount = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.resolvedAt && data.resolvedAt < ninetyDaysAgo) {
          if (operationCount === 499) {
            batches.push(writeBatch(db));
            currentBatchIndex++;
            operationCount = 0;
          }
          batches[currentBatchIndex].delete(doc.ref);
          operationCount++;
          deleteCount++;
        }
      });

      if (deleteCount > 0) {
        await Promise.all(batches.map(batch => batch.commit()));
        console.log(`System: Cleaned up ${deleteCount} old resolved reports.`);
      }
    }
  } catch (e) {
    console.error("Error cleaning up old reports:", e);
  }
};

export const processGlobalLeaderboards = async (force: boolean = false) => {
  const today = new Date().toISOString().split('T')[0];
  const lastUpdateRef = doc(db, 'meta', 'globalleaderboards_lastupdate');
  const lastUpdateSnap = await getDoc(lastUpdateRef);
  
  if (!force && lastUpdateSnap.exists() && lastUpdateSnap.data().lastUpdateDate === today) {
    return; // Already updated today
  }

  const usersRef = collection(db, 'users');
  const usersSnap = await getDocs(usersRef);
  const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));

  const validUsers = users.filter(u => u.username);

  // Sort and calculate ranks
  const sortedByWeight = [...validUsers].sort((a, b) => (b.litterStats?.weightKg || 0) - (a.litterStats?.weightKg || 0));
  const sortedByArea = [...validUsers].sort((a, b) => (b.litterStats?.areaSqM || 0) - (a.litterStats?.areaSqM || 0));
  const sortedByPieces = [...validUsers].sort((a, b) => (b.litterStats?.piecesCount || 0) - (a.litterStats?.piecesCount || 0));

  const userRanks: Record<string, { weight: number, area: number, pieces: number }> = {};
  
  sortedByWeight.forEach((u, i) => {
    if (!userRanks[u.id]) userRanks[u.id] = { weight: 0, area: 0, pieces: 0 };
    userRanks[u.id].weight = i + 1;
  });
  sortedByArea.forEach((u, i) => {
    if (!userRanks[u.id]) userRanks[u.id] = { weight: 0, area: 0, pieces: 0 };
    userRanks[u.id].area = i + 1;
  });
  sortedByPieces.forEach((u, i) => {
    if (!userRanks[u.id]) userRanks[u.id] = { weight: 0, area: 0, pieces: 0 };
    userRanks[u.id].pieces = i + 1;
  });

  // Update users in batches
  const batchSize = 400;
  const userIds = Object.keys(userRanks);
  
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = userIds.slice(i, i + batchSize);
    chunk.forEach(uid => {
      const userRef = doc(db, 'users', uid);
      batch.update(userRef, {
        globalRank_weight: userRanks[uid].weight,
        globalRank_area: userRanks[uid].area,
        globalRank_pieces: userRanks[uid].pieces
      });
    });
    await batch.commit();
  }

  // Update last update date
  await setDoc(lastUpdateRef, { lastUpdateDate: today });

  // Remove the old globalleaderboards document if it exists
  const oldMetaRef = doc(db, 'meta', 'globalleaderboards');
  await deleteDoc(oldMetaRef).catch(() => {});
};

export const processDailyRewards = async (userId: string, userTeamId: string) => {
  const today = new Date().toISOString().split('T')[0];
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;
  const userData = userSnap.data();
  
  if (userData.lastRewardDate === today) return;

  // Get all teams to calculate leaderboard position
  const teamsRef = collection(db, 'teams');
  const teamsSnap = await getDocs(query(teamsRef, orderBy('totalArea', 'desc')));
  const teams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
  
  const teamIndex = teams.findIndex(t => t.id === userTeamId);
  const position = teamIndex + 1;
  const team = teams[teamIndex];

  if (!team) return;

  // Formula: (Daily Area / 100) * (100 / Position)
  const reward = Math.floor((team.dailyArea / 100) * (100 / position));

  await updateDoc(userRef, {
    availableScrap: (userData.availableScrap || 0) + reward,
    lastRewardDate: today
  });

  const teamRef = doc(db, 'teams', userTeamId);
  await updateDoc(teamRef, { dailyArea: 0 });
};

export const processMonthlyReset = async () => {
  const today = new Date();
  if (today.getDate() !== 1) return; // Only run on the 1st of the month

  const teamsRef = collection(db, 'teams');
  const teamsSnap = await getDocs(teamsRef);
  const teams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));

  const batch = writeBatch(db);
  
  const shardResetInfo: Record<string, string> = {};
  const monthName = today.toLocaleString('default', { month: 'long', year: 'numeric' });

  teams.forEach(team => {
    const teamRef = doc(db, 'teams', team.id);
    const shardNum = Math.floor(Math.random() * 10);
    const shardId = `compete_${shardNum}`;
    
    shardResetInfo[shardNum.toString()] = monthName;

    batch.update(teamRef, {
      totalArea: 0,
      dailyArea: 0,
      litterStats: { weightKg: 0, areaSqM: 0, piecesCount: 0 },
      shardId: shardId // Random shard
    });
  });

  // Update shard reset info in meta/leaderboard
  const leaderboardMetaRef = doc(db, 'meta', 'leaderboard');
  batch.set(leaderboardMetaRef, shardResetInfo, { merge: true });

  await batch.commit();
};
