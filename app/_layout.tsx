import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import "@/tasks/geofenceTask"; // Must be imported in global scope for background execution

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth, AuthProvider } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { API_BASE_URL } from "@/api/config";
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { bgLog } from '@/src/utils/bgLogger';
import { flushOfflineQueue } from '@/src/utils/offlineQueue';
import { LogBox } from 'react-native';

// Suppress Expo's keep awake error that happens when background tasks run while in development mode
LogBox.ignoreLogs([
  /Unable to activate keep awake/i,
]);

const APP_CLOSED_TS_KEY = 'geo-checkin:app_closed_ts';

// Set up Android notification channel so notifications appear when app is closed.
// Without this, Android 8+ silently drops local notifications from background tasks.
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('geofence-alerts', {
    name: 'Check-in / Check-out Alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#22c55e',
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });
}

// Ensure push notifications show up even when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const PRODUCTION_URL = 'https://gca-50041716687.development.catalystappsail.in';

// Set API base URL — ALWAYS falls back to production, never localhost
const apiUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : __DEV__ && Constants.expoConfig?.hostUri
      ? `http://${Constants.expoConfig.hostUri.split(":")[0]}:3000`
      : PRODUCTION_URL);

// Store the API URL so the background task can use it even when app is closed
AsyncStorage.setItem("geo-checkin:api_url", apiUrl);



// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isLoaded, isAuthenticated, token } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { expoPushToken } = usePushNotifications();

  useEffect(() => {
    if (isAuthenticated && token && expoPushToken?.data) {
      fetch(`${API_BASE_URL}/api/users/push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pushToken: expoPushToken.data })
      }).catch(err => console.log("Failed to send push token", err));
    }
  }, [isAuthenticated, token, expoPushToken]);

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to the sign-in page.
      router.replace("/(auth)/sign-in");
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect away from the sign-in page.
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoaded, segments]);

  if (!isLoaded) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)/sign-in" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="employee/[name]" options={{ presentation: 'modal', title: 'Employee Details' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // ── App lifecycle tracking ──
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // On app open: check if we were previously closed and log the gap
    (async () => {
      const closedTs = await AsyncStorage.getItem(APP_CLOSED_TS_KEY);
      const now = new Date();
      const nowStr = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      if (closedTs) {
        const closedDate = new Date(parseInt(closedTs, 10));
        const closedStr = closedDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const gapMin = Math.round((now.getTime() - closedDate.getTime()) / 60000);
        await bgLog.info(`🟢 APP OPENED at ${nowStr} — was closed since ${closedStr} (${gapMin} min ago)`);
        await AsyncStorage.removeItem(APP_CLOSED_TS_KEY);
      } else {
        await bgLog.info(`🟢 APP OPENED at ${nowStr} (fresh start)`);
      }
      
      const flushed = await flushOfflineQueue();
      if (flushed) {
        await bgLog.info(`✅ Successfully pushed offline events to server on app start!`);
        queryClient.invalidateQueries({ queryKey: ['checkins'] });
      }
    })();

    // Listen for background/foreground transitions
    const sub = AppState.addEventListener('change', async (nextState) => {
      const now = new Date();
      const nowStr = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      if (appStateRef.current.match(/active/) && nextState === 'background') {
        // App going to background / being closed
        await AsyncStorage.setItem(APP_CLOSED_TS_KEY, now.getTime().toString());
        await bgLog.info(`🔶 APP GOING TO BACKGROUND at ${nowStr}`);
      } else if (appStateRef.current.match(/background|inactive/) && nextState === 'active') {
        // App coming back to foreground
        const closedTs = await AsyncStorage.getItem(APP_CLOSED_TS_KEY);
        if (closedTs) {
          const closedDate = new Date(parseInt(closedTs, 10));
          const closedStr = closedDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
          const gapMin = Math.round((now.getTime() - closedDate.getTime()) / 60000);
          await bgLog.info(`🟢 APP RETURNED TO FOREGROUND at ${nowStr} — was in background since ${closedStr} (${gapMin} min)`);
          await AsyncStorage.removeItem(APP_CLOSED_TS_KEY);
        } else {
          await bgLog.info(`🟢 APP RETURNED TO FOREGROUND at ${nowStr}`);
        }
        
        // Trigger offline queue processing when returning to foreground
        const flushed = await flushOfflineQueue();
        if (flushed) {
          await bgLog.info(`✅ Successfully pushed offline events to server on foreground!`);
          queryClient.invalidateQueries({ queryKey: ['checkins'] });
        }
      }

      appStateRef.current = nextState;
    });

    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
