# Geofencing Attendance App

A complete geofence-based attendance tracking solution built with React Native (Expo) for the mobile client and a Node.js Express server backed by MongoDB.

## 🚀 Overview

This application automates employee check-ins and check-outs based on their physical location relative to predefined job sites (geofences). It completely removes the need for manual time-logging by utilizing background location tracking.

### Key Features
- **Automatic Check-In/Out**: Uses GPS to detect when an employee enters or exits a designated radius.
- **Background Tracking**: Runs a persistent Foreground Service (on Android) to ensure geofences trigger even when the app is swiped away or the phone is locked.
- **Role-Based Access**: 
  - **Admins** can create job sites, define geofence radii, assign employees, and view all daily logs.
  - **Employees** can view their assigned locations, current status, and history of worked hours.
- **Daily Logs & Timesheets**: Automatically calculates total hours worked, lunch breaks, and flags late check-ins or short hours (half-days).
- **Push Notifications**: Sends local push notifications instantly when an automatic check-in or check-out occurs.
- **Idempotent Logic & Offline Caching**: The mobile app caches geofences and check-in states to handle "cold starts" and ensures duplicate check-ins aren't generated when network issues occur.

---

## 🛠️ Tech Stack & Languages

### Mobile App (Frontend)
- **Language**: TypeScript (`.ts`, `.tsx`)
- **Framework**: React Native & Expo (SDK 54)
- **Routing**: Expo Router (file-based navigation)
- **Background Processing**: `expo-location` and `expo-task-manager`
- **Notifications**: `expo-notifications`
- **State Management / Data Fetching**: React Query (`@tanstack/react-query`) & AsyncStorage

### Server (Backend)
- **Language**: JavaScript (`.js`)
- **Framework**: Node.js with Express.js
- **Database**: MongoDB (using Mongoose ODM)
- **Authentication**: JWT (JSON Web Tokens)
- **Deployment**: Hosted on Catalyst AppSail (Zoho)

---

## 🏗️ How We Developed It

### 1. The Server Architecture
We started by building an Express server (`server/server.js`) to act as the central source of truth. We defined several MongoDB Mongoose schemas:
- **Users**: Handles authentication and roles (`admin` vs `employee`).
- **Locations**: Stores the latitude, longitude, radius, and shift timings (start/end, lunch) for job sites.
- **CheckIns**: Records active check-in sessions.
- **DailyLogs**: Aggregates the check-ins/check-outs for a single day to calculate total `workedMinutes` and any applicable flags (e.g., `late_checkin`).

### 2. The React Native Client
We initialized an Expo project and built out the UI using modern React hooks and standard components. 
- The app has two main flows: an Admin dashboard (to manage locations and users) and an Employee dashboard (to view status and history).
- We implemented `React Query` to keep server state synchronized with the UI effortlessly.

### 3. The Core Challenge: Background Geofencing
The most complex part of the development was ensuring the app accurately tracks location even when killed by the user.
- We defined a global background task (`GEOFENCE_TASK_NAME`) in `src/tasks/geofenceTask.ts`.
- When the user is assigned a location, the app starts `Location.startLocationUpdatesAsync`.
- The task wakes up the app headless in the background whenever the OS detects a significant location change.
- It calculates the distance to assigned locations. If the user is inside the radius, it sends a `POST /api/checkins` request. If they exit, it sends a `POST .../checkout` request.

### 4. Overcoming OS Restrictions (The "Sleep" Issue)
To prevent Android's aggressive battery optimization from killing our location listener:
1. We utilized an Android **Foreground Service** with a sticky notification (e.g., "Monitoring for job site arrival").
2. We added a fallback system: If the app is opened after being asleep, it instantly evaluates its current coordinates and forces a sync with the server using the exact timestamp of arrival/departure.
3. We added verbose timestamp logging on the server to precisely track the milliseconds a payload arrives vs when it is saved to the database.

---

## 💻 Running the Project Locally

### Prerequisites
- Node.js (v18+)
- MongoDB (Local instance or MongoDB Atlas URI)
- Expo Go app on your phone, or an Android Emulator/iOS Simulator

### Setting up the Server
1. Navigate to the `server/` directory: `cd server`
2. Install dependencies: `npm install`
3. Create a `.env` file and set your `MONGO_URI` and `JWT_SECRET`.
4. Start the server: `npm start` (Runs on port 3000)

### Setting up the App
1. Navigate to the root directory.
2. Install dependencies: `npm install`
3. Ensure the `PRODUCTION_URL` or local IP in `src/api/config.ts` points to your running server.
4. Start Expo: `npx expo start`
5. Scan the QR code with your phone or press `a` to open in Android emulator.

---

## 📝 Notes for Future Development
- **Fake GPS Testing**: When using mock location apps for testing, ensure the phone's battery settings for this app are set to "Unrestricted", otherwise the OS may block mock location broadcasts when the app is backgrounded.
- **AppSail Deployment**: The backend is optimized for AppSail. Ensure the `PORT` environment variable is dynamically accepted from the host environment (`process.env.X_ZOHO_CATALYST_LISTEN_PORT || process.env.PORT || 3000`).
