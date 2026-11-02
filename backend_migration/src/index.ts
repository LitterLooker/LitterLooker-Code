import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { GeoFirestore } from "geofirestore";

admin.initializeApp();
const db = admin.firestore();

// Helper: Calculate distance between two coordinates in meters
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Helper: Determine multiplier based on active zones
const getMultiplierForLocation = async (lat: number, lng: number): Promise<number> => {
  const now = Date.now();
  const zonesSnapshot = await db.collection("zones").get();
  
  let maxMultiplier = 1;

  zonesSnapshot.forEach((doc) => {
    const zone = doc.data();
    // Check if zone is active
    if ((!zone.startTime || now >= zone.startTime) && (!zone.endTime || now < zone.endTime)) {
      const distance = calculateDistance(lat, lng, zone.lat, zone.lng);
      if (distance <= zone.radius) {
        if (zone.multiplier > maxMultiplier) {
          maxMultiplier = zone.multiplier;
        }
      }
    }
  });

  return maxMultiplier;
};

// ==========================================
// 1. Secure Litter Report Submission
// ==========================================
export const submitLitterReport = functions.https.onCall(async (data, context) => {
  // 1. Authentication Check
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const uid = context.auth.uid;
  const { lat, lng, description, imageUrl, urgency } = data;

  // 2. Validation
  if (!lat || !lng || !imageUrl) {
    throw new functions.https.HttpsError("invalid-argument", "Missing location or image.");
  }

  // 3. Calculate Multiplier (Server-Side Authority)
  // We do NOT trust the multiplier sent by the client. We calculate it ourselves.
  const multiplier = await getMultiplierForLocation(lat, lng);
  
  // 4. Calculate Rewards
  const baseReward = 500;
  const totalReward = baseReward * multiplier;

  const userRef = db.collection("users").doc(uid);

  try {
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "User profile not found.");
      }

      const userData = userDoc.data()!;
      
      // Update User Stats
      transaction.update(userRef, {
        totalXP: (userData.totalXP || 0) + totalReward,
        availableXP: (userData.availableXP || 0) + totalReward,
        monthlyXP: (userData.monthlyXP || 0) + totalReward,
        pinsSubmittedCount: (userData.pinsSubmittedCount || 0) + 1,
        lastActionDate: new Date().toISOString().split('T')[0] // YYYY-MM-DD
      });

      // Create the Pin
      const pinRef = db.collection("pins").doc();
      transaction.set(pinRef, {
        id: pinRef.id,
        userId: uid,
        username: userData.username,
        description,
        lat,
        lng,
        imageUrl,
        urgency,
        timestamp: Date.now(),
        status: "pending",
        multiplierApplied: multiplier // For auditing
      });
    });

    return { success: true, reward: totalReward, multiplier };
  } catch (error) {
    console.error("Transaction failure:", error);
    throw new functions.https.HttpsError("internal", "Report submission failed.");
  }
});

// ==========================================
// 2. Secure Item Purchase
// ==========================================
export const purchaseItem = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required.");

  const uid = context.auth.uid;
  const { itemId, cost } = data;

  const userRef = db.collection("users").doc(uid);

  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) throw new functions.https.HttpsError("not-found", "User not found.");

    const userData = userDoc.data()!;
    const currentBalance = userData.availableXP || 0;
    const unlockedAssets = userData.unlockedAssets || [];

    // Check if already owned
    if (unlockedAssets.includes(itemId)) {
      throw new functions.https.HttpsError("already-exists", "Item already unlocked.");
    }

    // Check balance
    if (currentBalance < cost) {
      throw new functions.https.HttpsError("failed-precondition", "Insufficient Scrap.");
    }

    // Deduct balance and add item
    transaction.update(userRef, {
      availableXP: currentBalance - cost,
      unlockedAssets: admin.firestore.FieldValue.arrayUnion(itemId)
    });

    return { success: true, newBalance: currentBalance - cost };
  });
});

// ==========================================
// 3. Scheduled Leaderboard Reset (Cron Job)
// ==========================================
// Runs automatically at midnight on the 1st of every month
export const scheduledLeaderboardReset = functions.pubsub
  .schedule("0 0 1 * *") // Cron syntax: At 00:00 on day-of-month 1
  .timeZone("America/Los_Angeles")
  .onRun(async (context) => {
    console.log("Starting monthly leaderboard reset...");
    
    const currentMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());
    
    // 1. Get all users with > 0 monthly XP
    const usersSnapshot = await db.collection("users")
      .where("monthlyXP", ">", 0)
      .get();

    const batch = db.batch();
    let operationCount = 0;

    usersSnapshot.docs.forEach((doc) => {
      const u = doc.data();
      
      // Calculate Rank & Reward Logic here (simplified for example)
      // In a real app, you would group by leaderboardId first
      
      batch.update(doc.ref, {
        monthlyXP: 0,
        lastResetMonth: currentMonth,
        // You would calculate pending rewards here based on their final rank
      });

      operationCount++;
    });

    await batch.commit();
    console.log(`Reset complete. Processed ${operationCount} users.`);
    return null;
  });
