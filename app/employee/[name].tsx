import React, { useState } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown } from "react-native-reanimated";
import { WebView } from "react-native-webview";

import { useColors } from "@/hooks/useColors";
import { useListCheckIns, useListLocations, useListDailyLogs, useListEmployees } from "@/hooks/useQueries";

const generateMapHTML = (lat: number, lng: number, locationData: any, empName: string, isLive: boolean) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
            body { padding: 0; margin: 0; background-color: #f3f4f6; }
            html, body, #map { height: 100%; width: 100%; }
        </style>
    </head>
    <body>
        <div id="map"></div>
        <script>
            var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(map);
            
            var marker = L.marker([${lat}, ${lng}]).addTo(map);
            marker.bindPopup("<div style='text-align:center;'><b>${isLive ? 'Within range' : 'Checked out'} - ${empName}</b></div>").openPopup();
            
            ${locationData ? `L.circle([${locationData.latitude}, ${locationData.longitude}], { radius: ${locationData.radiusMeters}, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15 }).addTo(map);` : ''}
        </script>
    </body>
    </html>
  `;
};

export default function EmployeeDetailsScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<'location' | 'logs'>('location');

  const { data: dailyLogs = [], isLoading: isLoadingDailyLogs, refetch: refetchLogs, isRefetching: isRefetchingLogs } = useListDailyLogs();
  const { data: allCheckIns = [], isLoading: isLoadingCheckIns, refetch: refetchCheckIns, isRefetching: isRefetchingCheckIns } = useListCheckIns();
  const { data: locations = [], isLoading: isLoadingLocations } = useListLocations();
  const { data: employees = [], isLoading: isLoadingEmployees, refetch: refetchEmployees, isRefetching: isRefetchingEmployees } = useListEmployees();

  const handleRefresh = async () => {
    await Promise.all([
      refetchCheckIns(),
      refetchEmployees(),
      refetchLogs()
    ]);
  };
  
  const isRefreshing = isRefetchingCheckIns || isRefetchingEmployees || isRefetchingLogs;

  const currentEmployee = employees.find((e: any) => e.name === name);

  // Filter logs for this specific employee
  const employeeLogsRaw = allCheckIns.filter((c: any) => !!c.userName && c.userName === name);
  
  // Filter out bounce logs (completed logs less than 60s)
  const employeeLogs = employeeLogsRaw.filter((item: any) => {
    if (item.status === 'active') return true;
    if (!item.checkOutAt) return true;
    const duration = new Date(item.checkOutAt).getTime() - new Date(item.checkInAt).getTime();
    return duration > 60000;
  });

  const activeCheckIn = employeeLogs.find((c: any) => c.status === "active");

  const locationData = activeCheckIn 
    ? locations.find((l: any) => l.id === activeCheckIn.locationId) 
    : null;

  // Prefer live tracking location, fallback to last checkin if live tracking hasn't synced yet
  const displayLat = currentEmployee?.lastLatitude ?? (activeCheckIn || employeeLogs[0])?.lastLatitude;
  const displayLng = currentEmployee?.lastLongitude ?? (activeCheckIn || employeeLogs[0])?.lastLongitude;
  
  const hasLocationToDisplay = displayLat !== undefined && displayLng !== undefined;

  // Get daily logs for this employee
  const employeeDailyLogs = dailyLogs.filter((l: any) => l.userName === name);
  
  // Calculate Metrics
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - (6 * 24 * 60 * 60 * 1000); // Last 7 days

  let todayMins = 0;
  let weekMins = 0;
  let lateDaysCount = 0;

  employeeDailyLogs.forEach((log: any) => {
    const logTime = new Date(log.date).getTime();
    if (logTime >= todayStart) {
      todayMins += log.workedMinutes || 0;
    }
    if (logTime >= weekStart) {
      weekMins += log.workedMinutes || 0;
    }
    if (log.flags && log.flags.includes('late_checkin')) {
      lateDaysCount++;
    }
  });

  const todayHours = (todayMins / 60).toFixed(1);
  const weekHours = (weekMins / 60).toFixed(1);

  if (isLoadingCheckIns || isLoadingLocations || isLoadingDailyLogs || isLoadingEmployees) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function formatMinutes(totalMins: number) {
    if (totalMins < 60) return `${totalMins}m`;
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hours}h ${mins}m`;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 16, justifyContent: 'space-between' }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={colors.mutedForeground} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="refresh-cw" size={20} color={colors.mutedForeground} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
            {name.charAt(0).toUpperCase()}
          </Text>
          <View style={[styles.statusDot, { backgroundColor: activeCheckIn ? '#22c55e' : '#64748b' }]} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{name}</Text>
          <Text style={[styles.empIdText, { color: colors.mutedForeground }]}>ID: {currentEmployee?.employeeId || 'EMP-0KZ9R5'}</Text>
        </View>
      </View>

      <View style={styles.segmentedControlWrap}>
        <View style={[styles.segmentedControl, { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.05)' }]}>
          <TouchableOpacity 
            style={[styles.segmentBtn, activeTab === 'logs' && { backgroundColor: colors.primary }]}
            onPress={() => setActiveTab('logs')}
          >
            <Feather name="calendar" size={16} color={activeTab === 'logs' ? colors.primaryForeground : colors.mutedForeground} style={{ marginRight: 8 }} />
            <Text style={[styles.segmentText, { color: activeTab === 'logs' ? colors.primaryForeground : colors.mutedForeground }]}>Daily logs</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.segmentBtn, activeTab === 'location' && { backgroundColor: colors.primary }]}
            onPress={() => setActiveTab('location')}
          >
            <Feather name="map-pin" size={16} color={activeTab === 'location' ? colors.primaryForeground : colors.mutedForeground} style={{ marginRight: 8 }} />
            <Text style={[styles.segmentText, { color: activeTab === 'location' ? colors.primaryForeground : colors.mutedForeground }]}>Live map</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'location' ? (
        <View style={styles.contentArea}>
          {hasLocationToDisplay ? (
            <View style={{ flex: 1 }}>
              <WebView
                key={`${displayLat}-${displayLng}-${activeCheckIn ? 'in' : 'out'}`}
                originWhitelist={['*']}
                source={{ 
                  html: generateMapHTML(displayLat, displayLng, locationData, name, activeCheckIn !== undefined),
                  baseUrl: 'https://unpkg.com'
                }}
                style={{ flex: 1, backgroundColor: 'transparent' }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                scrollEnabled={false}
                startInLoadingState={true}
                renderLoading={() => (
                  <View style={[StyleSheet.absoluteFillObject, styles.center]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                )}
              />
              <View style={styles.mapOverlay}>
                <BlurView intensity={80} tint="dark" style={styles.mapPill}>
                  <View style={[styles.statusIndicator, { backgroundColor: activeCheckIn ? '#22c55e' : '#ef4444' }]} />
                  <Text style={styles.mapPillText}>
                    {activeCheckIn ? "Active Zone" : "Live Location (Checked Out)"}
                  </Text>
                </BlurView>
              </View>
            </View>
          ) : (
            <View style={[styles.emptyMap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="map-pin" size={32} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
              <Text style={{ color: colors.mutedForeground }}>No location data available.</Text>
            </View>
          )}
        </View>
      ) : (
        <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          
          <Animated.View entering={FadeInDown.delay(50)} style={styles.metricsRow}>
            <View style={[styles.metricCard, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={[styles.metricValue, { color: colors.foreground }]}>{todayHours}h</Text>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Today</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={[styles.metricValue, { color: colors.foreground }]}>{weekHours}h</Text>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>This week</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={[styles.metricValue, { color: colors.foreground }]}>{lateDaysCount}</Text>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Late days</Text>
            </View>
          </Animated.View>

          <View style={styles.logsSection}>
            {employeeDailyLogs.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, marginTop: 20 }}>No daily logs found for {name}.</Text>
            ) : (
              employeeDailyLogs.map((log: any, index: number) => {
                const hasFlags = log.flags && log.flags.length > 0;
                
                // Determine first check-in and last check-out times
                const enterEvent = log.events.find((e: any) => e.type === 'enter');
                const exitEvent = [...log.events].reverse().find((e: any) => e.type === 'exit');
                const inTime = enterEvent ? formatTime(enterEvent.time) : '--:--';
                const outTime = exitEvent ? formatTime(exitEvent.time) : '--:--';
                const hoursWorkedStr = (log.workedMinutes / 60).toFixed(1);

                return (
                  <Animated.View key={log.id} entering={FadeInDown.delay((index + 1) * 50)} style={[styles.logCard, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1 }]}>
                    <View style={styles.logHeader}>
                      <Text style={[styles.logDateText, { color: colors.foreground }]}>
                        {new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                      <View style={[styles.hoursPill, { borderColor: colors.primary }]}>
                        <Text style={[styles.hoursPillText, { color: colors.primary }]}>{hoursWorkedStr}h worked</Text>
                      </View>
                    </View>

                    <Text style={[styles.logTimesText, { color: colors.mutedForeground }]}>
                      In {inTime} - Out {outTime}
                    </Text>

                    {hasFlags && (
                      <View style={styles.flagsList}>
                        {log.flags.map((flag: string) => {
                          let displayFlag = flag.replace('_', ' ');
                          if (flag === 'late_checkin') displayFlag = 'Late check-in';
                          if (flag === 'early_checkin') displayFlag = 'Early check-in';
                          if (flag === 'half_day') displayFlag = 'Half day (Lunch entry)';
                          if (flag === 'short_hours_half_day') displayFlag = 'Short hours (< 5h)';
                          
                          return (
                            <View key={flag} style={styles.flagItem}>
                              <Feather name="alert-triangle" size={14} color={colors.primary} style={{ marginRight: 6 }} />
                              <Text style={[styles.flagText, { color: colors.primary }]}>
                                {displayFlag}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </Animated.View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  backButton: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#1e1e1e', // Dark border to blend with dark mode
  },
  profileInfo: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  empIdText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  segmentedControlWrap: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 30,
    borderWidth: 1,
    padding: 6,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 24,
  },
  segmentText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  contentArea: {
    flex: 1,
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scrollContent: {
    flex: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  mapOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  mapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  mapPillText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  emptyMap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logsSection: {
    paddingHorizontal: 24,
  },
  logCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logDateText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  hoursPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  hoursPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  logTimesText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    marginBottom: 16,
  },
  flagsList: {
    flexDirection: 'column',
    gap: 8,
  },
  flagItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  }
});
