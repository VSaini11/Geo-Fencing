# 🚀 Google Play Store Publishing Guide

Getting your Expo app onto the Google Play Store is highly streamlined thanks to Expo Application Services (EAS). Here is the step-by-step guide to take this app from your PC to the Play Store!

---

## Step 1: Create a Google Play Developer Account
1. Go to the [Google Play Console](https://play.google.com/console).
2. Sign in with a Google account and pay the one-time **$25 developer registration fee**.
3. Verify your identity (Google will ask for an ID/passport to verify you are a real developer).

## Step 2: Prepare your `app.json`
Before building the final version, you need to make sure your `app.json` has a unique "Package Name". I have likely already set one, but you must ensure it matches this format:
```json
{
  "expo": {
    "name": "Geofencing App",
    "version": "1.0.0",
    "android": {
      "package": "com.yourcompany.geofencing",
      "versionCode": 1
    }
  }
}
```
*Note: The `package` name must be entirely unique across the whole Play Store (e.g., `com.vaibhavsaini.geofencing`).*

## Step 3: Build the `.aab` Production Bundle
The Google Play Store **does not accept `.apk` files** anymore. You must build an **Android App Bundle (`.aab`)**.
Luckily, EAS does this for you automatically when you run a production build!

Run this command in your terminal:
```bash
eas build -p android --profile production
```
1. Expo will ask you if you want to generate a new Android Keystore. Type **Y** (Yes). *Expo will safely store this security key in the cloud for you.*
2. Wait for the build to finish.
3. Download the generated `.aab` file to your PC.

## Step 4: Setup your Play Store Listing
1. Log into your Google Play Console.
2. Click **Create App** and give it a name and default language.
3. Fill out the **Store Presence** (Main Store Listing). You will need:
   - A short and full description.
   - A High-Res App Icon (512x512).
   - A Feature Graphic (1024x500).
   - At least 2 to 3 screenshots of the app running (you can take these on your own phone).
4. Create a free **Privacy Policy** (you can use a free privacy policy generator online and host it on Google Docs or a free website). Google requires a privacy policy for all apps that track location!

## Step 5: Upload and Release
1. In the Play Console menu, go to **Testing -> Internal Testing** or **Production -> Create New Release**.
2. Upload the `.aab` file you downloaded from Expo.
3. Write some release notes (e.g., "Initial launch of the Geofencing tracker!").
4. Submit the app for review!

**Google usually takes 3 to 7 days to review and approve a brand new app.** Once approved, anyone can search for it and download it directly from the Play Store!
