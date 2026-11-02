# Instructions for Converting LitterLooker to a Google Play Store App

To turn this React web application into a native Android app for the Google Play Store, we recommend using **Capacitor**, a cross-platform app runtime that makes it easy to build web apps that run natively on iOS and Android.

## Prerequisites

1.  **Node.js and npm**: Ensure you have these installed on your development machine.
2.  **Android Studio**: Required for building and signing the Android app.
3.  **Google Play Console Account**: Required to publish the app ($25 one-time fee).

## Step 1: Install Capacitor

In your project root directory, run:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init
```

When prompted:
*   **App name**: LitterLooker
*   **App ID**: com.litterlooker.app (or your preferred unique ID)
*   **Web asset directory**: dist

## Step 2: Add Android Platform

```bash
npm install @capacitor/android
npx cap add android
```

## Step 3: Build the Web App

Before syncing with Android, you must build the production version of your web app:

```bash
npm run build
```

## Step 4: Sync with Android

This command copies your web assets into the Android project:

```bash
npx cap sync android
```

## Step 5: Open in Android Studio

```bash
npx cap open android
```

## Step 6: Configure Android Project

In Android Studio:
1.  **Icons**: Generate and replace the default Capacitor icons in `app/src/main/res`.
2.  **Permissions**: Ensure `AndroidManifest.xml` includes necessary permissions (Camera, Location, Internet).
3.  **App Versioning**: Update `versionCode` and `versionName` in `app/build.gradle`.

## Step 7: Build and Sign for Release

1.  In Android Studio, go to **Build > Generate Signed Bundle / APK**.
2.  Select **Android App Bundle** (preferred for Google Play).
3.  Create a new **Key Store** if you don't have one. **Keep this file safe!** You will need it for all future updates.
4.  Follow the wizard to build the `.aab` file.

## Step 8: Submit to Google Play Console

1.  Log in to the [Google Play Console](https://play.google.com/console).
2.  Create a new app and fill in the store listing details (description, screenshots, etc.).
3.  Upload your `.aab` file to a production release.
4.  Complete the content rating and app content questionnaires.
5.  Submit for review.

## Maintenance

Whenever you make changes to the web code:
1.  Run `npm run build`
2.  Run `npx cap copy android`
3.  Rebuild in Android Studio.
