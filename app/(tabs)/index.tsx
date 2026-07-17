import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRouter } from "expo-router";

import { RadarCircle } from "@/components/RadarCircle";
import { useAuth } from "@/hooks/useAuth";
import { useColors } from "@/hooks/useColors";
import { useGeofence } from "@/hooks/useGeofence";
import { useListCheckIns, useListLocations, useListEmployees } from "@/hooks/useQueries";
import { getBearing } from "@/utils/distance";

function formatDuration(diffInSeconds: number) {
  const hours = Math.floor(diffInSeconds / 3600);
  const minutes = Math.floor((diffInSeconds % 3600) / 60);
  const seconds = diffInSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function LunchBanner() {
  const [isLunch, setIsLunch] = useState(false);

  useEffect(() => {
    const checkLunch = () => {
      const h = new Date().getHours();
      setIsLunch(h === 12);
    };
    checkLunch();
    const interval = setInterval(checkLunch, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!isLunch) return null;

  return (
    <Animated.View
      entering={FadeIn}
      style={{
        backgroundColor: "#f59e0b20",
        borderColor: "#f59e0b",
        borderWidth: 1,
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Feather name="coffee" size={20} color="#f59e0b" style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#f59e0b", fontWeight: "bold", fontSize: 15, marginBottom: 2 }}>
          Lunch Time Active
        </Text>
        <Text style={{ color: "#f59e0b", opacity: 0.9, fontSize: 13 }}>
          Current time is designated for lunch break (12:00 PM - 1:00 PM).
        </Text>
      </View>
    </Animated.View>
  );
}

function AdminStatusView() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userName } = useAuth();
  const { data: allCheckIns = [], isLoading, refetch } = useListCheckIns();
  const { data: employees = [] } = useListEmployees();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todaysCheckInsRaw = allCheckIns.filter((c: any) => {
    if (!c.userName) return false;
    // Do not show the current admin's own check-in/out
    if (c.userName === userName) return false;
    if (c.userName.toLowerCase() === 'admin') return false;
    
    // If we have the employees list loaded, ensure the check-in belongs to an actual employee
    if (employees.length > 0) {
      const isEmployee = employees.some((emp: any) => emp.name === c.userName);
      if (!isEmployee) return false;
    }
    
    return new Date(c.checkInAt).getTime() >= todayStart.getTime();
  });

  const latestCheckIns = Object.values(
    todaysCheckInsRaw.reduce((acc: any, checkIn: any) => {
      const key = checkIn.userName!;
      if (!acc[key] || new Date(checkIn.checkInAt).getTime() > new Date(acc[key].checkInAt).getTime()) {
        acc[key] = checkIn;
      }
      return acc;
    }, {} as Record<string, typeof allCheckIns[0]>)
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 100, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <Text style={[styles.header, { color: colors.foreground }]}>Today's Activity</Text>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: -16, marginBottom: 24, fontSize: 16 }]}>
        {latestCheckIns.length} {latestCheckIns.length === 1 ? "employee" : "employees"} active today
      </Text>

      <LunchBanner />

      {latestCheckIns.length === 0 && !isLoading && (
        <Animated.View
          entering={FadeIn}
          style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
        >
          <Feather name="users" size={32} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
          <Text style={{ color: colors.mutedForeground, textAlign: "center", fontSize: 16 }}>
            No employee activity recorded today.
          </Text>
        </Animated.View>
      )}

      {latestCheckIns.map((checkIn: any, index: number) => {
        const isActive = checkIn.status === "active";
        
        return (
          <Animated.View key={checkIn.id} entering={FadeInDown.delay(100 + index * 50).springify()} style={styles.section}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/employee/${checkIn.userName}`)}>
              <BlurView intensity={80} tint="dark" style={[styles.adminCard, { borderColor: isActive ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)" }]}>
                <View style={styles.adminCardHeader}>
                  <View style={styles.adminCardTitleRow}>
                    <View style={[styles.statusIndicator, { backgroundColor: isActive ? "#22c55e" : "#ef4444", marginRight: 8 }]} />
                    <Text style={styles.adminEmployeeName}>{checkIn.userName || "Unknown Employee"}</Text>
                    {(() => {
                      const employee = employees.find((emp: any) => emp.name === checkIn.userName);
                      const isLoggedOut = employee?.isLoggedOut;
                      
                      if (isLoggedOut) {
                        return (
                          <View style={{ backgroundColor: "#64748b30", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                            <Text style={{ color: "#94a3b8", fontSize: 10, fontFamily: "Inter_700Bold" }}>LOGGED OUT</Text>
                          </View>
                        );
                      } else if (!isActive) {
                        return (
                          <View style={{ backgroundColor: "#ef444430", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                            <Text style={{ color: "#ef4444", fontSize: 10, fontFamily: "Inter_700Bold" }}>CHECKED OUT</Text>
                          </View>
                        );
                      }
                      return null;
                    })()}
                  </View>
                <Text style={styles.adminLocationName}>{checkIn.locationName}</Text>
              </View>

              <View style={styles.adminCardMetrics}>
                <View style={styles.adminMetric}>
                  <Feather name="clock" size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.adminMetricText}>
                    Since {new Date(checkIn.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
                <View style={styles.adminMetric}>
                  <Feather name="map-pin" size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.adminMetricText}>
                    {checkIn.lastLatitude.toFixed(5)}, {checkIn.lastLongitude.toFixed(5)}
                  </Text>
                </View>
                </View>
              </BlurView>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

// ─── Stable Status Card ───────────────────────────────────────────────────────
// Uses shared values so color/opacity transitions are smooth and don't
// cause the card to flash between states on load.
function StatusCard({
  activeCheckIn,
  isCheckInsLoading,
  durationStr,
}: {
  activeCheckIn: any;
  isCheckInsLoading: boolean;
  durationStr: string;
}) {
  const checkedIn = useSharedValue(0); // 0 = out, 1 = in

  useEffect(() => {
    if (!isCheckInsLoading) {
      checkedIn.value = withTiming(activeCheckIn ? 1 : 0, { duration: 400 });
    }
  }, [activeCheckIn, isCheckInsLoading]);

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      checkedIn.value,
      [0, 1],
      ["rgba(100, 116, 139, 0.5)", "rgba(34, 197, 94, 0.7)"]
    ),
    borderColor: interpolateColor(
      checkedIn.value,
      [0, 1],
      ["rgba(100, 116, 139, 0.7)", "rgba(34, 197, 94, 0.9)"]
    ),
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isCheckInsLoading ? 0.3 : activeCheckIn ? 1 : 0.5, { duration: 300 }),
  }));

  if (isCheckInsLoading) {
    // Skeleton — no flicker, just a neutral loading state
    return (
      <Animated.View style={[styles.statusCard, cardStyle, { borderWidth: 1 }]}>
        <View style={styles.statusHeader}>
          <Animated.View style={[styles.statusIndicator, { backgroundColor: "#fff" }, dotStyle]} />
          <Text style={[styles.statusTitle, { color: "rgba(255,255,255,0.5)" }]}>LOADING…</Text>
        </View>
        <View style={styles.activeDetails}>
          <ActivityIndicator color="rgba(255,255,255,0.5)" size="small" style={{ marginBottom: 16 }} />
          <View style={[styles.metricsRow, { opacity: 0.3 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.durationLabel, { color: "rgba(255,255,255,0.8)" }]}>Today's Total Time</Text>
              <Text style={[styles.durationValue, { color: "#fff" }]}>—</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.statusCard, cardStyle, { borderWidth: 1, overflow: "hidden" }]}>
      <View style={styles.statusHeader}>
        <Animated.View style={[styles.statusIndicator, { backgroundColor: "#fff" }, dotStyle]} />
        <Text style={[styles.statusTitle, { color: "#fff", opacity: activeCheckIn ? 1 : 0.8 }]}>
          {activeCheckIn ? "CHECKED IN" : "CHECKED OUT"}
        </Text>
      </View>

      <View style={styles.activeDetails}>
        {activeCheckIn ? (
          <>
            <Text style={[styles.locationName, { color: "#fff" }]}>{activeCheckIn.locationName}</Text>
            {activeCheckIn.userName && (
              <Text style={[styles.checkedInAs, { color: "rgba(255,255,255,0.85)" }]}>
                Checked in as {activeCheckIn.userName}
              </Text>
            )}
          </>
        ) : (
          <Text style={[styles.inactiveText, { color: "rgba(255,255,255,0.9)", marginBottom: 20 }]}>
            Move within range of an assigned location to automatically check in and resume tracking.
          </Text>
        )}

        <View style={styles.metricsRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.durationLabel, { color: "rgba(255,255,255,0.8)" }]}>Today's Total Time</Text>
            <Text style={[styles.durationValue, { color: "#fff" }]}>{durationStr || "0m 0s"}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Location Card with debounced GPS ────────────────────────────────────────
// Debounce location updates so the radar/distance text doesn't thrash on every
// GPS ping (which can fire 1-4 times per second in foreground).
function NearestLocationCard({
  nearestLocation,
  currentLocation,
  activeCheckIn,
  colors,
}: {
  nearestLocation: { location: any; distance: number } | null;
  currentLocation: Location.LocationObject | null;
  activeCheckIn: any;
  colors: any;
}) {
  const [stable, setStable] = useState(nearestLocation);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Debounce: only update display every 2 seconds to avoid jitter
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStable(nearestLocation), 2000);
    // But update immediately if location changes (different location entirely)
    if (nearestLocation?.location?.id !== stable?.location?.id) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setStable(nearestLocation);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [nearestLocation]);

  if (!stable) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>Finding nearest location…</Text>
      </View>
    );
  }

  const bearing = currentLocation
    ? getBearing(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        stable.location.latitude,
        stable.location.longitude
      )
    : 0;

  return (
    <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.locName, { color: colors.foreground }]}>{stable.location.name}</Text>
      <Text style={[styles.locDistance, { color: colors.mutedForeground }]}>
        {Math.round(stable.distance)}m away (Radius: {stable.location.radiusMeters}m)
      </Text>

      <View style={styles.radarWrap}>
        <RadarCircle
          size={220}
          radiusMeters={stable.location.radiusMeters}
          distanceMeters={stable.distance}
          bearingDeg={bearing}
          isInside={!!activeCheckIn && activeCheckIn.locationId === stable.location.id}
          pulse={!!activeCheckIn && activeCheckIn.locationId === stable.location.id}
          centerLabel={stable.location.name}
        />
      </View>

      {stable.distance > stable.location.radiusMeters && (
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.progressBar,
              {
                backgroundColor: colors.primary,
                width: `${Math.min(100, Math.max(0, (stable.location.radiusMeters / stable.distance) * 100))}%`,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

function EmployeeStatusView() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentLocation, nearestLocation, trackingError, activeCheckIn, hasAssignedLocations } = useGeofence();
  const { userName } = useAuth();
  const { data: allCheckIns = [], isLoading: isCheckInsLoading } = useListCheckIns();
  const { isLoading: isLoadingLocations } = useListLocations();

  const [durationStr, setDurationStr] = useState("");

  useEffect(() => {
    const calculateTotalTime = () => {
      if (!userName) return 0;

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      const todayCheckIns = allCheckIns.filter((c: any) => {
        if (c.userName !== userName) return false;
        const checkInTime = new Date(c.checkInAt).getTime();
        return checkInTime >= startOfDay;
      });

      let totalSeconds = 0;
      let hasAddedActive = false;

      todayCheckIns.forEach((c: any) => {
        if (c.status === "completed" && c.checkOutAt) {
          const inTime = new Date(c.checkInAt).getTime();
          const outTime = new Date(c.checkOutAt).getTime();
          totalSeconds += Math.max(0, Math.floor((outTime - inTime) / 1000));
        } else if (c.status === "active" && !hasAddedActive) {
          const inTime = new Date(c.checkInAt).getTime();
          totalSeconds += Math.max(0, Math.floor((Date.now() - inTime) / 1000));
          hasAddedActive = true;
        }
      });

      return totalSeconds;
    };

    const interval = setInterval(() => {
      setDurationStr(formatDuration(calculateTotalTime()));
    }, 1000);

    setDurationStr(formatDuration(calculateTotalTime()));
    return () => clearInterval(interval);
  }, [allCheckIns, activeCheckIn, userName]);

  const [permissionStatus] = Location.useForegroundPermissions();

  if (!permissionStatus) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (permissionStatus.status !== "granted") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.destructive }]}>
          Location permission is required for auto check-in.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 100, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.header, { color: colors.foreground }]}>Status</Text>

      <LunchBanner />

      {trackingError && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.errorCard, { backgroundColor: colors.destructive + "20", borderColor: colors.destructive }]}
        >
          <Text style={{ color: colors.destructive, fontWeight: "600" }}>{trackingError}</Text>
        </Animated.View>
      )}

      {/* Status Card — smooth animated, no flicker */}
      {hasAssignedLocations || isLoadingLocations ? (
        <>
          <View style={styles.section}>
            <StatusCard
              activeCheckIn={activeCheckIn}
              isCheckInsLoading={isCheckInsLoading}
              durationStr={durationStr}
            />
          </View>

          {/* Nearest Location — debounced so radar doesn't thrash */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Nearest Location</Text>
            <NearestLocationCard
              nearestLocation={nearestLocation}
              currentLocation={currentLocation}
              activeCheckIn={activeCheckIn}
              colors={colors}
            />
          </View>
        </>
      ) : (
        <View style={styles.section}>
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 8 }}>
              No Locations Assigned
            </Text>
            <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>
              You do not have any geofence locations assigned to you. Contact your admin to be assigned a location so you can check in.
            </Text>
          </View>
        </View>
      )}

      {/* Live GPS */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Live GPS</Text>
        {currentLocation ? (
          <View style={[styles.gpsCard, { backgroundColor: colors.secondary }]}>
            <View style={styles.gpsRow}>
              <Text style={[styles.gpsLabel, { color: colors.mutedForeground }]}>LAT</Text>
              <Text style={[styles.gpsText, { color: colors.secondaryForeground }]}>
                {currentLocation.coords.latitude.toFixed(6)}
              </Text>
            </View>
            <View style={styles.gpsRow}>
              <Text style={[styles.gpsLabel, { color: colors.mutedForeground }]}>LNG</Text>
              <Text style={[styles.gpsText, { color: colors.secondaryForeground }]}>
                {currentLocation.coords.longitude.toFixed(6)}
              </Text>
            </View>
            <View style={styles.gpsRow}>
              <Text style={[styles.gpsLabel, { color: colors.mutedForeground }]}>ACCURACY</Text>
              <Text
                style={[
                  styles.gpsText,
                  {
                    color:
                      currentLocation.coords.accuracy && currentLocation.coords.accuracy > 40
                        ? colors.destructive
                        : colors.primary,
                  },
                ]}
              >
                ±{Math.round(currentLocation.coords.accuracy || 0)}m
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>Acquiring signal…</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

export default function StatusScreen() {
  const { role } = useAuth();

  if (role === "admin") {
    return <AdminStatusView />;
  }

  return <EmployeeStatusView />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    flex: 1,
  },
  header: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  errorCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
  },
  activeDetails: {
    marginTop: 8,
  },
  locationName: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  checkedInAs: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginBottom: 20,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.15)",
    padding: 12,
    borderRadius: 12,
  },
  durationLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    fontFamily: "Inter_600SemiBold",
  },
  durationValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
  },
  inactiveText: {
    fontSize: 15,
    lineHeight: 24,
    fontFamily: "Inter_400Regular",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  locationCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  radarWrap: {
    alignItems: "center",
    marginVertical: 12,
  },
  locName: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  locDistance: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    marginTop: 12,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  gpsCard: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  gpsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gpsLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  gpsText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    fontVariant: ["tabular-nums"],
  },
  adminCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  adminCardHeader: {
    marginBottom: 12,
  },
  adminCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  adminEmployeeName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.3,
  },
  adminLocationName: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
  },
  adminCardMetrics: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: 12,
    borderRadius: 12,
  },
  adminMetric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  adminMetricText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#fff",
  },
});
