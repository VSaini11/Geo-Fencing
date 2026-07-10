import React, { useState } from "react";
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useListDailyLogs } from "@/hooks/useQueries";
import { useAuth } from "@/hooks/useAuth";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  
  const { data: dailyLogs, isLoading } = useListDailyLogs();
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedLogId(prev => prev === id ? null : id);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: colors.foreground }]}>Daily Logs</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={dailyLogs || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isExpanded = expandedLogId === item.id;
            const hasFlags = item.flags && item.flags.length > 0;

            return (
              <View style={[styles.logCard, { backgroundColor: colors.card, borderColor: hasFlags ? colors.destructive : 'transparent', borderWidth: hasFlags ? 1 : 0 }]}>
                <TouchableOpacity style={styles.logSummary} onPress={() => toggleExpand(item.id)} activeOpacity={0.7}>
                  <View style={styles.dateCol}>
                    <Text style={[styles.dateText, { color: colors.foreground }]}>{formatDate(item.date)}</Text>
                    {role === 'admin' && (
                      <Text style={[styles.userNameText, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {item.userName}
                      </Text>
                    )}
                  </View>
                  <View style={styles.hoursCol}>
                    <View style={styles.hoursBadge}>
                      <Text style={styles.hoursText}>{formatMinutes(item.workedMinutes)} worked</Text>
                    </View>
                    {item.lunchMinutes > 0 && (
                      <Text style={[styles.breakText, { color: colors.mutedForeground }]}>{formatMinutes(item.lunchMinutes)} break</Text>
                    )}
                    {item.unscheduledMinutes > 0 && (
                      <Text style={[styles.breakText, { color: colors.destructive }]}>{formatMinutes(item.unscheduledMinutes)} unsch.</Text>
                    )}
                  </View>
                  <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
                </TouchableOpacity>

                {hasFlags && (
                  <View style={[styles.flagsContainer, { backgroundColor: 'rgba(255, 0, 0, 0.1)' }]}>
                    {item.flags.map((flag: string, idx: number) => {
                      let displayFlag = flag.replace('_', ' ');
                      if (flag === 'late_checkin') displayFlag = 'Late check-in';
                      if (flag === 'half_day') displayFlag = 'Half day (Lunch entry)';
                      if (flag === 'short_hours_half_day') displayFlag = 'Short hours (< 5h)';

                      return (
                        <Text key={`${flag}-${idx}`} style={[styles.flagText, { color: colors.destructive }]}>
                          ⚠️ {displayFlag}
                        </Text>
                      );
                    })}
                  </View>
                )}

                {isExpanded && (
                  <View style={styles.eventsContainer}>
                    <Text style={[styles.eventsTitle, { color: colors.foreground }]}>Timeline Events</Text>
                    {item.events
                      .filter((ev: any) => ev.type !== 'ping')
                      .map((ev: any, idx: number) => {
                        let iconName = "circle";
                        let iconColor = colors.mutedForeground;

                        if (ev.type === 'enter') {
                          iconName = "log-in";
                          iconColor = colors.primary;
                        } else if (ev.type === 'exit') {
                          iconName = "log-out";
                          if (ev.tag === 'lunch') iconColor = colors.accent;
                          else if (ev.tag === 'unscheduled') iconColor = colors.destructive;
                          else iconColor = colors.primary;
                        }

                        return (
                          <View key={idx} style={styles.eventRow}>
                            <View style={[styles.eventLine, { backgroundColor: colors.border }]} />
                            <Feather name={iconName as any} size={16} color={iconColor} style={styles.eventIcon} />
                            <Text style={[styles.eventTime, { color: colors.foreground }]}>{formatTime(ev.time)}</Text>
                            <Text style={[styles.eventType, { color: iconColor }]}>
                              {ev.type.toUpperCase()}
                              {ev.tag && ev.tag !== 'active' ? ` • ${ev.tag.replace('_', ' ')}` : ''}
                            </Text>
                          </View>
                        );
                      })}
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Feather name="calendar" size={48} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyText, { color: colors.foreground }]}>No daily logs found.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  logCard: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  logSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  dateCol: {
    flex: 1,
  },
  dateText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  userNameText: {
    fontSize: 14,
  },
  hoursCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  hoursBadge: {
    backgroundColor: '#007AFF20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  hoursText: {
    color: '#007AFF',
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  breakText: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  flagsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flagText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: 'capitalize',
  },
  eventsContainer: {
    padding: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.1)',
  },
  eventsTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 12,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 4,
    position: 'relative',
  },
  eventLine: {
    position: 'absolute',
    left: 11,
    top: 20,
    bottom: -15,
    width: 2,
  },
  eventIcon: {
    marginRight: 8,
    backgroundColor: 'transparent',
  },
  eventTime: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    width: 65,
  },
  eventType: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  }
});
