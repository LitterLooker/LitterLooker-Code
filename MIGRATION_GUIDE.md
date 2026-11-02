# Backend Migration Guide: Moving to Server-Authoritative Architecture

This guide explains how to deploy the new backend functions and update your frontend to use them.

## Phase 1: Deploying the Backend

### 1. Install Firebase Tools
Open your terminal and run:
```bash
npm install -g firebase-tools
```

> **Troubleshooting:**
> *   **"Permission denied" (macOS/Linux):** Run `sudo npm install -g firebase-tools` and enter your password.
> *   **"command not found":** You need to install Node.js first. Download it from [nodejs.org](https://nodejs.org/).
> *   **Windows:** Open your terminal as an Administrator.

### 2. Login to Google
```bash
firebase login
```

### 3. Initialize Functions
Navigate to your project root and run:
```bash
firebase init functions
```
- Select **TypeScript** when asked.
- Select **Use existing project**.
- Do **NOT** overwrite `package.json` or `index.ts` if asked (or backup the files I created for you first).

### 4. Copy the New Code
Copy the contents of `backend_migration/src/index.ts` into your newly created `functions/src/index.ts`.
Copy the dependencies from `backend_migration/package.json` into `functions/package.json`.

### 5. Deploy
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

---

## Phase 2: Updating the Frontend (Client)

Once your functions are deployed, you need to update `App.tsx` and other components to call them instead of doing the math locally.

### 1. Import `httpsCallable`
In `src/services/firebase.ts`, add:
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';
export const functions = getFunctions(app);
```

### 2. Replace `handleAwardScrap` in `App.tsx`
**Current (Insecure):**
```typescript
const handleAwardScrap = async (amount) => {
   // Client calculates multiplier...
   // Client writes to DB...
}
```

**New (Secure):**
```typescript
const handleAwardScrap = async (amount) => {
  const submitReport = httpsCallable(functions, 'submitLitterReport');
  
  try {
    const result = await submitReport({
      lat: userLocation.lat,
      lng: userLocation.lng,
      imageUrl: currentImage,
      description: description
    });
    
    console.log("Server Response:", result.data);
    // The server has already updated the DB. 
    // The onSnapshot listener in App.tsx will automatically see the new XP and update the UI.
  } catch (error) {
    console.error("Report failed", error);
  }
}
```

### 3. Replace Item Purchase Logic
In `StorePage.tsx` or wherever purchases happen:

**New (Secure):**
```typescript
const buyItem = async (itemId) => {
  const purchase = httpsCallable(functions, 'purchaseItem');
  await purchase({ itemId: itemId, cost: 500 });
}
```

## Phase 3: Verify

1.  **Test with a fake location:** Try to send a report with coordinates that are far away from you. The server function should reject it or give a 1x multiplier, proving that client-side spoofing no longer works.
2.  **Check Logs:** Go to the Firebase Console -> Functions -> Logs to see your server logic executing.
