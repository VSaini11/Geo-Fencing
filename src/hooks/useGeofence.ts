import { useAuth } from "@/hooks/useAuth";
import {
  getListCheckInsQueryKey,
  useCheckOutCheckIn,
  useCreateCheckIn,
  useListCheckIns,
  useListLocations,
  usePingCheckIn,
  useUpdateLiveLocation,
} from "@/hooks/useQueries";
import { getDistanceMeters } from "@/utils/distance";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useEffect, useMemo, useRef, useState } from "react";
import { CACHED_ACTIVE_CHECKIN_KEY, CACHED_CHECKINS_KEY, CACHED_LOCATIONS_KEY, GEOFENCE_TASK_NAME } from "../tasks/geofenceTask";
import { flushOfflineQueue, pushOfflineEvent } from "../utils/offlineQueue";

export function useGeofence() {
  const queryClient = useQueryClient();
  const { data: locations = [] } = useListLocations();
  const { userName } = useAuth();

  const { data: allCheckIns = [], isLoading: isCheckInsLoading } = useListCheckIns();

  const createCheckIn = useCreateCheckIn();
  const pingCheckIn = usePingCheckIn();
  const checkOutCheckIn = useCheckOutCheckIn();
  const updateLiveLocation = useUpdateLiveLocation();

  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [nearestLocation, setNearestLocation] = useState<{ location: any; distance: number } | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [permissionsGranted, setPermissionsGranted] = useState<boolean>(false);
  // ── Cache-First UI Logic (Fixes "Buffering") ──────────────────────────────
  const [cachedActiveCheckIn, setCachedActiveCheckIn] = useState<any>(null);
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CACHED_ACTIVE_CHECKIN_KEY).then(val => {
      if (val) {
        try { setCachedActiveCheckIn(JSON.parse(val)); } catch (e) { }
      }
      setIsCacheLoaded(true);
    });
  }, []);

  // Compute activeCheckIn: trust fresh server data, but show cache while loading
  const activeCheckIn = useMemo(() => {
    const serverData = allCheckIns.find((c: any) => c.status === "active" && c.userName === userName);
    if (serverData) return serverData;
    
    // Protect offline-created pending checkins from being wiped by the foreground
    if (cachedActiveCheckIn && cachedActiveCheckIn.status === 'active' && String(cachedActiveCheckIn.id || '').startsWith('pending-')) {
      return cachedActiveCheckIn;
    }
    
    if (!isCheckInsLoading) return undefined;
    return cachedActiveCheckIn || undefined;
  }, [allCheckIns, isCheckInsLoading, cachedActiveCheckIn, userName]);

  // Refs for background-safe access in processLocationUpdate
  const activeCheckInRef = useRef(activeCheckIn);
  activeCheckInRef.current = activeCheckIn;

  const prevNearestRef = useRef<{ locationId: string; distance: number } | null>(null);
  // ──────────────────────────────────────────────────────────────────────────

  const validLocations = useMemo(() => {
    return locations.filter((loc: any) => {
      if (loc.assignedEmployees && loc.assignedEmployees.length > 0) {
        return loc.assignedEmployees.includes(userName);
      }
      return false; // Strict mapping: if not explicitly assigned, employee cannot check in
    });
  }, [locations, userName]);

  const locationsRef = useRef(validLocations);
  locationsRef.current = validLocations;

  const userNameRef = useRef(userName);
  userNameRef.current = userName;

  // ── Offline cache writer ────────────────────────────────────────────────────
  useEffect(() => {
    if (validLocations.length > 0) {
      AsyncStorage.setItem(CACHED_LOCATIONS_KEY, JSON.stringify(validLocations)).catch(() => { });
    }
  }, [validLocations]);

  useEffect(() => {
    if (!isCacheLoaded) return;
    const checkinToCache = activeCheckIn || null;
    AsyncStorage.setItem(CACHED_ACTIVE_CHECKIN_KEY, JSON.stringify(checkinToCache)).catch(() => { });
  }, [activeCheckIn ? (activeCheckIn.id || activeCheckIn._id) : null, isCacheLoaded]);

  // Keep full check-ins list cached for instant UI on next app open
  useEffect(() => {
    if (allCheckIns.length > 0) {
      AsyncStorage.setItem(CACHED_CHECKINS_KEY, JSON.stringify(allCheckIns)).catch(() => { });
    }
  }, [allCheckIns]);
  // ── End offline cache writer ────────────────────────────────────────────────

  const lastPingTimeRef = useRef<number>(0);
  const lastLiveLocationPingRef = useRef<number>(0);
  const isProcessingRef = useRef(false);
  const MAX_ALLOWED_ACCURACY = 40; // Ignore any ping with accuracy worse than 40m

  const outsideSinceRef = useRef<number | null>(null);
  const insideSinceRef = useRef<number | null>(null);

  const startupSettledRef = useRef(false);
  const appStartTimeRef = useRef(Date.now());

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let startupTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function startTracking() {
      try {
        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
        if (locStatus !== "granted") {
          setTrackingError("Location permission denied. Cannot track geofences.");
          return;
        }

        try {
          const { status: notifStatus } = await Notifications.requestPermissionsAsync();
          if (notifStatus !== 'granted') {
            console.warn("Push notification permission denied.");
          }
        } catch (err) {
          console.warn("Failed to request notification permission", err);
        }

        try {
          const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
          if (bgStatus !== 'granted') {
            console.warn("Background location permission NOT granted.");
          } else {
            setPermissionsGranted(true);
          }
        } catch (bgErr) {
          console.warn("Background location permission denied:", bgErr);
        }

        startupSettledRef.current = false;
        startupTimer = setTimeout(() => {
          if (!cancelled) startupSettledRef.current = true;
        }, 2000);

        try {
          const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
          if (!cancelled) {
            setCurrentLocation(initial);
          }
        } catch { /* ignore */ }

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (loc) => {
            setCurrentLocation(loc);
            processLocationUpdate(loc);
          }
        );

        pollInterval = setInterval(async () => {
          try {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
            if (!cancelled) {
              setCurrentLocation(loc);
              processLocationUpdate(loc);
            }
          } catch (err: any) {
            if (!cancelled) setTrackingError(err.message);
          }
        }, 4000);
      } catch (err: any) {
        setTrackingError(err.message);
      }
    }

    startTracking();

    return () => {
      cancelled = true;
      if (locationSubscription) locationSubscription.remove();
      if (pollInterval) clearInterval(pollInterval);
      if (startupTimer) clearTimeout(startupTimer);
    };
  }, []);

  const lastRegisteredCheckedInRef = useRef<boolean | null>(null);
  useEffect(() => {
    async function registerGeofences() {
      try {
        if (!permissionsGranted) return;

        const { status } = await Location.getBackgroundPermissionsAsync();
        if (status !== 'granted') return;

        // Register GEOFENCE_TASK_NAME unconditionally if we have permissions
        // This single task handles both geofencing (if validLocations exist) and 5-min live tracking
        const checkedInLoc = activeCheckIn
          ? validLocations.find((l: any) => l.id === activeCheckIn.locationId || l._id === activeCheckIn.locationId)
          : null;
        const isCheckedIn = !!activeCheckIn;

        const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(GEOFENCE_TASK_NAME);

        if (!alreadyRunning || lastRegisteredCheckedInRef.current !== isCheckedIn) {
          lastRegisteredCheckedInRef.current = isCheckedIn;
          await Location.startLocationUpdatesAsync(GEOFENCE_TASK_NAME, {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 15000,
            distanceInterval: 10,
            deferredUpdatesInterval: 0, // 0 = Force Android to deliver immediately instead of batching/sleeping
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: isCheckedIn
                ? `✅ Checked In${checkedInLoc ? ` — ${checkedInLoc.name}` : ''}`
                : 'Live Tracking Active',
              notificationBody: isCheckedIn
                ? 'Monitoring your location for automatic checkout.'
                : 'Monitoring for job site arrival.',
              notificationColor: isCheckedIn ? '#22c55e' : '#3b82f6',
            },
          });
        }
      } catch (err) {
        console.warn('Geofencing setup error:', err);
      }
    }

    registerGeofences();
  }, [validLocations, activeCheckIn ? (activeCheckIn.id || activeCheckIn._id) : null, permissionsGranted]);

  const processLocationUpdate = async (loc: Location.LocationObject) => {
    if (isProcessingRef.current) return;

    // FAST-TRACK: Check for pending background data immediately on app open.
    const flushed = await flushOfflineQueue();
    if (flushed) {
      queryClient.invalidateQueries({ queryKey: getListCheckInsQueryKey() });
    }

    const checkInsQueryState = queryClient.getQueryState(getListCheckInsQueryKey());
    const dataFreshnessMs = checkInsQueryState?.dataUpdatedAt ?? 0;

    // Process immediately if we just flushed data OR if the query is fresh.
    if (!flushed && dataFreshnessMs < appStartTimeRef.current) {
      if (!startupSettledRef.current) return;
    }

    isProcessingRef.current = true;

    try {
      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;
      const accuracy = loc.coords.accuracy ?? 100;
      const now = loc.timestamp || Date.now();

      if (accuracy > MAX_ALLOWED_ACCURACY) {
        setTrackingError(`Poor GPS signal (${Math.round(accuracy)}m).`);
        return;
      }

      if (now - lastLiveLocationPingRef.current >= 300000) {
        lastLiveLocationPingRef.current = now;
        updateLiveLocation.mutate({ latitude: lat, longitude: lon });
      }

      if (locationsRef.current.length === 0) return;

      let nearest = null;
      let minDistance = Infinity;

      for (const location of locationsRef.current) {
        const d = getDistanceMeters(lat, lon, location.latitude, location.longitude);
        if (d < minDistance) {
          minDistance = d;
          nearest = location;
        }
      }

      if (nearest) {
        const locId = nearest.id || nearest._id;
        const prev = prevNearestRef.current;
        if (!prev || prev.locationId !== locId || Math.abs(prev.distance - minDistance) > 2) {
          prevNearestRef.current = { locationId: locId, distance: minDistance };
          setNearestLocation({ location: nearest, distance: minDistance });
        }
      }

      const currentCheckIn = activeCheckInRef.current;

      if (currentCheckIn) {
        const checkedInLoc = locationsRef.current.find((l: any) => l.id === currentCheckIn.locationId || l._id === currentCheckIn.locationId);
        if (checkedInLoc) {
          const d = getDistanceMeters(lat, lon, checkedInLoc.latitude, checkedInLoc.longitude);

          if (d > checkedInLoc.radiusMeters) {
            outsideSinceRef.current = null;
            
            // Optimistic Checkout
            setCachedActiveCheckIn(null);
            
            await pushOfflineEvent({
              type: 'checkout',
              id: currentCheckIn.id || currentCheckIn._id,
              latitude: lat,
              longitude: lon,
              timestamp: now
            });
            await flushOfflineQueue();
            queryClient.invalidateQueries({ queryKey: getListCheckInsQueryKey() });
            return;
          } else {
            outsideSinceRef.current = null;
          }
        } else {
          outsideSinceRef.current = null;
          
          // Optimistic Checkout
          setCachedActiveCheckIn(null);
          
          await pushOfflineEvent({
            type: 'checkout',
            id: currentCheckIn.id || currentCheckIn._id,
            latitude: lat,
            longitude: lon,
            timestamp: now
          });
          await flushOfflineQueue();
          queryClient.invalidateQueries({ queryKey: getListCheckInsQueryKey() });
          return;
        }

        if (now - lastPingTimeRef.current >= 300000) {
          lastPingTimeRef.current = now;
          pingCheckIn.mutate({
            id: currentCheckIn.id || currentCheckIn._id,
            data: { latitude: lat, longitude: lon },
          });
        }
      } else {
        outsideSinceRef.current = null;
        if (nearest && minDistance <= nearest.radiusMeters) {
          if (!insideSinceRef.current) insideSinceRef.current = now;
          if (now - insideSinceRef.current >= 3000) {
            insideSinceRef.current = null;

            const locId = nearest.id || nearest._id;
            
            // Optimistic Check-in
            setCachedActiveCheckIn({
              id: 'pending-' + Date.now(),
              locationId: locId,
              status: 'active',
              userName: userNameRef.current ?? undefined
            });

            await pushOfflineEvent({
              type: 'checkin',
              locationId: locId,
              latitude: lat,
              longitude: lon,
              userName: userNameRef.current ?? undefined,
              timestamp: now
            });
            await flushOfflineQueue();
            queryClient.invalidateQueries({ queryKey: getListCheckInsQueryKey() });
          }
        } else {
          insideSinceRef.current = null;
        }
      }

      setTrackingError(null);
    } catch (err: any) {
      setTrackingError(err?.message ?? "Sync failed.");
    } finally {
      isProcessingRef.current = false;
    }
  };

  return {
    currentLocation,
    nearestLocation,
    trackingError,
    activeCheckIn,
  };
}
