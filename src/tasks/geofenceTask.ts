import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { getDistanceMeters } from '../utils/distance';
import { flushOfflineQueue, pushOfflineEvent } from '../utils/offlineQueue';

export const GEOFENCE_TASK_NAME = 'GEOFENCE_TASK';

// Keys shared between background task and foreground hook.
export const PENDING_CHECKIN_TS_KEY = 'geo-checkin:pending_checkin_ts';
export const PENDING_CHECKOUT_KEY = 'geo-checkin:pending_checkout'; // Stores { id, lat, lon, timestamp }

// Offline cache
export const CACHED_LOCATIONS_KEY = 'geo-checkin:cached_locations';
export const CACHED_ACTIVE_CHECKIN_KEY = 'geo-checkin:cached_active_checkin';
export const CACHED_CHECKINS_KEY = 'geo-checkin:cached_checkins';
export const LAST_BG_SYNC_KEY = 'geo-checkin:last_bg_sync';
export const BACKGROUND_FETCH_TASK = 'background-fetch-task';

// Hardcode production URL as primary — background context cannot use __DEV__ env reliably
const PRODUCTION_URL = 'https://gca-50041716687.development.catalystappsail.in';

/**
 * Update the foreground service sticky notification in real-time.
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
  } catch (_) {}
}

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[BG Task] Error:', error.message);
    return;
  }
  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  const currentLocation = locations[locations.length - 1];
  const accuracy = currentLocation.coords.accuracy ?? 100;
  if (accuracy > 300) return;

  const lat = currentLocation.coords.latitude;
  const lon = currentLocation.coords.longitude;
  const now = currentLocation.timestamp || Date.now();

  try {
    const sessionStr = await AsyncStorage.getItem("geo-checkin:auth:v2");
    if (!sessionStr) return;
    const session = JSON.parse(sessionStr);
    const token = session.token;
    const userName = session.userName;

    const savedUrl = await AsyncStorage.getItem("geo-checkin:api_url");
    const apiUrl = (savedUrl && !savedUrl.includes('localhost')) ? savedUrl : PRODUCTION_URL;

    const cachedLocsStr = await AsyncStorage.getItem(CACHED_LOCATIONS_KEY);
    const cachedActiveStr = await AsyncStorage.getItem(CACHED_ACTIVE_CHECKIN_KEY);

    let validLocations: any[] = cachedLocsStr ? JSON.parse(cachedLocsStr) : [];
    let activeCheckIn: any = cachedActiveStr ? JSON.parse(cachedActiveStr) : null;

    if (validLocations.length === 0) return;

    if (activeCheckIn) {
      const checkedInLoc = validLocations.find(l => l.id === activeCheckIn.locationId || l._id === activeCheckIn.locationId);
      if (checkedInLoc) {
        const d = getDistanceMeters(lat, lon, checkedInLoc.latitude, checkedInLoc.longitude);
        if (d > checkedInLoc.radiusMeters + 20) {
          const id = activeCheckIn.id || activeCheckIn._id;
          const DEDUP_KEY = `geo-checkin:checkout_done:${id}`;
          const alreadyDone = await AsyncStorage.getItem(DEDUP_KEY);
          if (alreadyDone && Date.now() - parseInt(alreadyDone, 10) < 15000) return;
          await AsyncStorage.setItem(DEDUP_KEY, Date.now().toString());

          await AsyncStorage.removeItem(PENDING_CHECKIN_TS_KEY);

          // Queue the event and try to flush immediately in background
          await pushOfflineEvent({
            type: 'checkout',
            id,
            latitude: lat,
            longitude: lon,
            timestamp: now
          });

          const flushed = await flushOfflineQueue(apiUrl, token);
          if (flushed) {
            await AsyncStorage.removeItem(CACHED_ACTIVE_CHECKIN_KEY);
          }

          await updateForegroundNotification(false);
          // Removed checkout push notification to prevent continuous spam
        } else {
          // 5-min ping
          const id = activeCheckIn.id || activeCheckIn._id;
          if (id) {
            const LAST_PING_KEY = `geo-checkin:last_bg_ping:${id}`;
            const lastPing = await AsyncStorage.getItem(LAST_PING_KEY);
            if (!lastPing || (Date.now() - parseInt(lastPing, 10) >= 300000)) {
              await AsyncStorage.setItem(LAST_PING_KEY, Date.now().toString());
              await fetch(`${apiUrl}/api/checkins/${id}/ping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ latitude: lat, longitude: lon })
              }).catch(() => {});
            }
          }
        }
      }
    } else {
      let nearestLoc = null;
      let minDistance = Infinity;
      for (const loc of validLocations) {
        const d = getDistanceMeters(lat, lon, loc.latitude, loc.longitude);
        if (d < minDistance) { minDistance = d; nearestLoc = loc; }
      }

      if (nearestLoc && minDistance <= nearestLoc.radiusMeters) {
        const locId = nearestLoc.id || nearestLoc._id;
        const DEDUP_KEY = `geo-checkin:checkin_done:${locId}`;
        const alreadyDone = await AsyncStorage.getItem(DEDUP_KEY);
        if (alreadyDone && Date.now() - parseInt(alreadyDone, 10) < 15000) return;
        await AsyncStorage.setItem(DEDUP_KEY, Date.now().toString());

        // Set an optimistic pending check-in so UI shows it immediately
        await AsyncStorage.setItem(CACHED_ACTIVE_CHECKIN_KEY, JSON.stringify({
          id: 'pending-' + now,
          locationId: locId,
          status: 'active',
          userName: userName,
          timestamp: now
        }));

        await pushOfflineEvent({
          type: 'checkin',
          locationId: locId,
          latitude: lat,
          longitude: lon,
          userName: userName,
          timestamp: now
        });

        // Try to sync immediately
        await flushOfflineQueue(apiUrl, token);
        await AsyncStorage.removeItem(PENDING_CHECKIN_TS_KEY);

        await updateForegroundNotification(true, nearestLoc.name);
        // Removed check-in push notification to prevent continuous spam
      }
    }
  } catch (e) {
    console.error('[BG Task] Error:', e);
  }
});

/**
 * Background fetch task to ensure offline queue is flushed periodically.
 * Registered in useGeofence.ts
 */
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const flushed = await flushOfflineQueue();
    return flushed ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (err) {
    console.error('[Background Fetch] Error:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});
