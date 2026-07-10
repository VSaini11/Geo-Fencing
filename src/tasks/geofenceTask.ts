import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';
import { bgLog } from '../utils/bgLogger';
import { getDistanceMeters } from '../utils/distance';
import { fetchWithAbortTimeout, flushOfflineQueue, pushOfflineEvent } from '../utils/offlineQueue';

export const GEOFENCE_TASK_NAME = 'GEOFENCE_TASK';

// Offline cache: the foreground hook writes these whenever it gets fresh
// data from the server. The BG task reads them as fallback when the server
// is sleeping so it can still do geofence logic without any network.
export const CACHED_LOCATIONS_KEY = 'geo-checkin:cached_locations';
export const CACHED_ACTIVE_CHECKIN_KEY = 'geo-checkin:cached_active_checkin';
export const CACHED_CHECKINS_KEY = 'geo-checkin:cached_checkins';  // Full check-ins list for instant UI
export const LAST_BG_SYNC_KEY = 'geo-checkin:last_bg_sync_ts';   // Timestamp of last BG data refresh

// Hardcode production URL as primary — background context cannot use __DEV__ env reliably
const PRODUCTION_URL = 'https://gca-50041716687.development.catalystappsail.in';

/**
 * Update the foreground service sticky notification in real-time.
 * Called after checkin/checkout so the Android persistent bar shows the correct state
 * even when the app is fully closed.
 */
async function updateForegroundNotification(isCheckedIn: boolean, locationName?: string) {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(GEOFENCE_TASK_NAME);
    if (!hasStarted) return;
    await Location.startLocationUpdatesAsync(GEOFENCE_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 15000,
      distanceInterval: 10,
      deferredUpdatesInterval: 0,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: isCheckedIn ? `✅ Checked In` : '🔴 Checked Out',
        notificationBody: isCheckedIn
          ? `Monitoring ${locationName || 'job site'} for automatic checkout.`
          : 'Monitoring for job site arrival.',
        notificationColor: isCheckedIn ? '#22c55e' : '#64748b',
      },
    });
  } catch (_) {
    // If the task isn't running, this is a no-op — safe to ignore
  }
}

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    bgLog.error(`Task error: ${error.message}`);
    return;
  }
  if (!data) return;

  // Detect if we're running while app is closed/killed
  const { locations } = data as { locations: Location.LocationObject[] };
  const appIsInForeground = AppState.currentState === 'active';
  if (!appIsInForeground) {
    await bgLog.info(`⚙️ BG task running HEADLESS (app state: ${AppState.currentState}), received ${locations.length} locations`);
  }

  if (!locations || locations.length === 0) return;

  try {
    // Read user session
    const sessionStr = await AsyncStorage.getItem("geo-checkin:auth:v2");
    if (!sessionStr) {
      bgLog.warn('No session found, skipping.');
      return;
    }
    const session = JSON.parse(sessionStr);
    if (!session.token || !session.userName) return;

    const token = session.token;
    const userName = session.userName;

    // Use saved URL, fall back to production — NEVER localhost
    const savedUrl = await AsyncStorage.getItem("geo-checkin:api_url");
    const apiUrl = (savedUrl && !savedUrl.includes('localhost') && !savedUrl.includes('127.0.0.1'))
      ? savedUrl
      : PRODUCTION_URL;

    // Fast-path: get cached data
    const cachedLocsStr = await AsyncStorage.getItem(CACHED_LOCATIONS_KEY);
    const cachedActiveStr = await AsyncStorage.getItem(CACHED_ACTIVE_CHECKIN_KEY);

    let validLocations: any[] = cachedLocsStr ? JSON.parse(cachedLocsStr) : [];
    let activeCheckIn: any = cachedActiveStr ? JSON.parse(cachedActiveStr) : null;

    // ALWAYS flush any pending offline events (check-ins/check-outs) first!
    // This handles the case where the server was asleep during the initial boundary crossing.
    await flushOfflineQueue(apiUrl, token);

    bgLog.info(`Cache: ${validLocations.length} locations, activeCheckIn: ${activeCheckIn ? 'yes' : 'no'}`);

    // ── Periodic Background Sync ──────────────────────────────────────────────
    // Every 5 minutes (while app is closed), fetch fresh data from the server
    // and update the cache. This way when the app opens, data is already fresh.
    const SYNC_INTERVAL = 300000; // 5 minutes
    const lastSyncStr = await AsyncStorage.getItem(LAST_BG_SYNC_KEY);
    const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;
    const shouldSync = !appIsInForeground && (Date.now() - lastSync >= SYNC_INTERVAL);

    if (shouldSync) {
      try {
        // Refresh locations
        const locsRes = await fetchWithAbortTimeout(`${apiUrl}/api/locations`, {
          headers: { Authorization: `Bearer ${token}` }
        }, 8000);
        if (locsRes.ok) {
          const allLocs = await locsRes.json();
          const filtered = allLocs.filter((loc: any) =>
            loc.assignedEmployees && loc.assignedEmployees.includes(userName)
          );
          await AsyncStorage.setItem(CACHED_LOCATIONS_KEY, JSON.stringify(filtered));
          validLocations = filtered;
          bgLog.info(`🔄 BG SYNC: refreshed ${filtered.length} locations`);
        }

        // Refresh check-ins (full list + active)
        const checkinsRes = await fetchWithAbortTimeout(`${apiUrl}/api/checkins`, {
          headers: { Authorization: `Bearer ${token}` }
        }, 8000);
        if (checkinsRes.ok) {
          const allCheckins = await checkinsRes.json();
          await AsyncStorage.setItem(CACHED_CHECKINS_KEY, JSON.stringify(allCheckins));
          const myActive = allCheckins.find((c: any) => c.status === 'active' && c.userName === userName);
          activeCheckIn = myActive || null;
          await AsyncStorage.setItem(CACHED_ACTIVE_CHECKIN_KEY, JSON.stringify(activeCheckIn));
          bgLog.info(`🔄 BG SYNC: refreshed ${allCheckins.length} check-ins, active: ${myActive ? 'yes' : 'no'}`);
        }

        await AsyncStorage.setItem(LAST_BG_SYNC_KEY, Date.now().toString());
      } catch (syncErr) {
        bgLog.warn(`BG SYNC failed (server may be sleeping): ${syncErr}`);
      }
    }
    // ── End Background Sync ───────────────────────────────────────────────────

    // If we STILL have no cached locations after sync, try one more time.
    if (validLocations.length === 0) {
      try {
        const locsRes = await fetchWithAbortTimeout(`${apiUrl}/api/locations`, {
          headers: { Authorization: `Bearer ${token}` }
        }, 5000);
        if (locsRes.ok) {
          const allLocations = await locsRes.json();
          validLocations = allLocations.filter((loc: any) =>
            loc.assignedEmployees && loc.assignedEmployees.includes(userName)
          );
          await AsyncStorage.setItem(CACHED_LOCATIONS_KEY, JSON.stringify(validLocations));
        }
      } catch (e) {
        bgLog.warn(`Initial locations fetch failed: ${e}`);
      }
    }

    if (validLocations.length === 0) {
      bgLog.info('No assigned locations for geofencing, but will continue for live tracking.');
    }

    // Process EVERY location in the batch chronologically
    for (const currentLocation of locations) {
      const lat = currentLocation.coords.latitude;
      const lon = currentLocation.coords.longitude;
      const accuracy = currentLocation.coords.accuracy ?? 100;
      const now = currentLocation.timestamp || Date.now();

      if (accuracy > 300) {
        bgLog.info(`Ignoring ping, accuracy: ${accuracy}m (threshold 300m)`);
        continue;
      }

      // Re-read activeCheckIn for each location in the batch since a previous location might have changed it
      const cachedActiveStr = await AsyncStorage.getItem(CACHED_ACTIVE_CHECKIN_KEY);
      let activeCheckIn: any = cachedActiveStr ? JSON.parse(cachedActiveStr) : null;

      if (activeCheckIn) {
        // Checked in — see if we left the geofence
        const checkedInLoc = validLocations.find(
          (l: any) => l.id === activeCheckIn.locationId || l._id === activeCheckIn.locationId
        );

        if (checkedInLoc) {
          const d = getDistanceMeters(lat, lon, checkedInLoc.latitude, checkedInLoc.longitude);
          bgLog.info(`Distance from ${checkedInLoc.name}: ${Math.round(d)}m (radius: ${checkedInLoc.radiusMeters}m)`);

          if (d > checkedInLoc.radiusMeters) {
            // OUTSIDE — checkout!
            const id = activeCheckIn.id || activeCheckIn._id;

            // Dedup guard
            const DEDUP_KEY = `geo-checkin:checkout_done:${id}`;
            const alreadyDone = await AsyncStorage.getItem(DEDUP_KEY);
            if (alreadyDone && Date.now() - parseInt(alreadyDone, 10) < 15000) {
              bgLog.info(`Checkout already processed for ${id}, skipping.`);
              continue;
            }
            await AsyncStorage.setItem(DEDUP_KEY, Date.now().toString());

            await updateForegroundNotification(false);
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "🔴 Checked Out",
                body: `You have left ${checkedInLoc.name || 'the job site'}.`,
                sound: true,
                data: { type: 'checkout' },
              },
              trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + 500), channelId: 'geofence-alerts' },
            });

            await pushOfflineEvent({ type: 'checkout', id, latitude: lat, longitude: lon, timestamp: now });
            await flushOfflineQueue(apiUrl, token);
            await AsyncStorage.removeItem(CACHED_ACTIVE_CHECKIN_KEY);
          } else {
            // INSIDE - Ping the server to update live location every 5 minutes
            const id = activeCheckIn.id || activeCheckIn._id;
            const LAST_PING_KEY = `geo-checkin:last_bg_ping:${id}`;
            const lastPing = await AsyncStorage.getItem(LAST_PING_KEY);
            if (!lastPing || (now - parseInt(lastPing, 10) >= 300000)) {
              await AsyncStorage.setItem(LAST_PING_KEY, now.toString());
              await fetch(`${apiUrl}/api/checkins/${id}/ping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ latitude: lat, longitude: lon })
              }).catch(() => { });
              bgLog.info(`Sent 5-min ping for ${id}`);
            }
          }
        } else {
          // Unassigned while checked in
          const id = activeCheckIn.id || activeCheckIn._id;
          if (id) {
            await pushOfflineEvent({ type: 'checkout', id, latitude: lat, longitude: lon, timestamp: now });
            await flushOfflineQueue(apiUrl, token);

            await updateForegroundNotification(false);
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "🔴 Checked Out",
                body: "You were removed from your assigned location.",
                sound: true,
                data: { type: 'checkout' },
              },
              trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + 500), channelId: 'geofence-alerts' },
            });
            await AsyncStorage.removeItem(CACHED_ACTIVE_CHECKIN_KEY);
          }
        }
      } else {
        // Not checked in — see if we entered a geofence
        let nearestLoc: any = null;
        let minDistance = Infinity;

        for (const loc of validLocations) {
          const d = getDistanceMeters(lat, lon, loc.latitude, loc.longitude);
          if (d < minDistance) {
            minDistance = d;
            nearestLoc = loc;
          }
        }

        if (nearestLoc && minDistance <= nearestLoc.radiusMeters) {
          // BACKGROUND FIX: Trigger check-in INSTANTLY.
          const locId = nearestLoc.id || nearestLoc._id;
          const DEDUP_KEY = `geo-checkin:checkin_done:${locId}`;
          const alreadyDone = await AsyncStorage.getItem(DEDUP_KEY);
          if (alreadyDone && Date.now() - parseInt(alreadyDone, 10) < 15000) {
            bgLog.info(`Check-in already processed for ${locId}, skipping.`);
            continue;
          }
          await AsyncStorage.setItem(DEDUP_KEY, Date.now().toString());

          bgLog.info(`✅ CHECKIN triggered! location: ${nearestLoc.name}, distance: ${Math.round(minDistance)}m`);

          // Optimistically update cache to prevent duplicate triggers
          await AsyncStorage.setItem(CACHED_ACTIVE_CHECKIN_KEY, JSON.stringify({
            id: 'pending-' + Date.now(),
            locationId: locId,
            status: 'active',
            userName: userName
          }));

          await updateForegroundNotification(true, nearestLoc.name);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "✅ Checked In",
              body: `You have arrived at ${nearestLoc.name || 'the job site'}.`,
              sound: true,
              data: { type: 'checkin' },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + 500), channelId: 'geofence-alerts' },
          });

          await pushOfflineEvent({
            type: 'checkin',
            locationId: locId,
            latitude: lat,
            longitude: lon,
            userName,
            timestamp: now
          });

          await flushOfflineQueue(apiUrl, token);
        }
      }
    }

    // ── Live Tracking Ping ────────────────────────────────────────────────────
    // Only ping live location if we moved (the batch ran) and 5 minutes passed
    const latestLoc = locations[locations.length - 1];
    const latestLat = latestLoc.coords.latitude;
    const latestLon = latestLoc.coords.longitude;
    const latestAccuracy = latestLoc.coords.accuracy ?? 100;

    if (latestAccuracy <= 300) {
      const nowMs = Date.now();
      const LAST_TRACK_KEY = 'geo-checkin:last_live_track_ping';
      const lastPingStr = await AsyncStorage.getItem(LAST_TRACK_KEY);

      if (!lastPingStr || (nowMs - parseInt(lastPingStr, 10) >= 280000)) { // 4.5 mins minimum gap
        await AsyncStorage.setItem(LAST_TRACK_KEY, nowMs.toString());
        await fetchWithAbortTimeout(`${apiUrl}/api/users/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ latitude: latestLat, longitude: latestLon })
        }, 5000).catch(() => { });
        bgLog.info(`Sent live tracking ping: ${latestLat}, ${latestLon}`);
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

  } catch (e: any) {
    bgLog.error(`Unhandled error: ${e?.message || e}`);
  }
});
