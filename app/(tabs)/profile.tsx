import React, { useState, useCallback } from "react";
import { StyleSheet, Text, View, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import { getBgLogs, clearBgLogs, BgLogEntry } from "@/src/utils/bgLogger";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userName, role, signOut } = useAuth();
  const router = useRouter();
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<BgLogEntry[]>([]);

  const openLogs = useCallback(async () => {
    const entries = await getBgLogs();
    setLogs(entries.reverse()); // newest first
    setShowLogs(true);
  }, []);

  const handleClearLogs = () => {
    Alert.alert("Clear Logs", "Delete all background logs?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: async () => { await clearBgLogs(); setLogs([]); } },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ paddingTop: insets.top }}>
        <View style={styles.headerRow}>
          <Text style={[styles.header, { color: colors.foreground }]}>Profile</Text>
        </View>

        <Animated.View entering={FadeInDown.delay(100)} style={{ marginHorizontal: 20 }}>
          <BlurView intensity={80} tint="dark" style={[styles.card, { borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Feather name={role === 'admin' ? "shield" : "user"} size={28} color={colors.primaryForeground} />
            </View>

            <Text style={[styles.cardTitle, { color: '#fff' }]}>{userName || "Unknown User"}</Text>
            
            <View style={[styles.roleBadge, { backgroundColor: role === 'admin' ? colors.primary : colors.secondary }]}>
              <Text style={[styles.roleText, { color: role === 'admin' ? colors.primaryForeground : colors.secondaryForeground }]}>
                {role === 'admin' ? "Admin" : "Employee"}
              </Text>
            </View>

            <Text style={[styles.cardDesc, { color: 'rgba(255,255,255,0.7)' }]}>
              This name and role is attached to your check-ins so others can see who checked in and out.
            </Text>

            <TouchableOpacity
              style={[styles.signOutBtn, { backgroundColor: colors.destructive }]}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <Feather name="log-out" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: '600', fontSize: 16 }}>Sign Out</Text>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)} style={{ marginHorizontal: 20, marginTop: 16 }}>
          <TouchableOpacity
            style={[styles.logsBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={openLogs}
            activeOpacity={0.8}
          >
            <Feather name="terminal" size={18} color={colors.foreground} />
            <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 15 }}>View Background Logs</Text>
          </TouchableOpacity>
        </Animated.View>

        <Modal visible={showLogs} animationType="slide" transparent>
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
            <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Background Logs</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={handleClearLogs}>
                    <Feather name="trash-2" size={20} color={colors.destructive} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowLogs(false)}>
                    <Feather name="x" size={22} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView style={styles.logScroll} showsVerticalScrollIndicator>
                {logs.length === 0 && (
                  <Text style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 40, fontSize: 15 }}>
                    No logs yet. Logs appear after background check-in/checkout events.
                  </Text>
                )}
                {logs.map((entry, i) => (
                  <View key={i} style={[styles.logEntry, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.logTime, { color: 'rgba(255,255,255,0.45)' }]}>{entry.time}</Text>
                    <Text style={[
                      styles.logMsg,
                      { color: entry.level === 'error' ? '#ef4444' : entry.level === 'warn' ? '#f59e0b' : 'rgba(255,255,255,0.85)' }
                    ]}>
                      {entry.msg}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 24,
  },
  header: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  card: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    overflow: "hidden",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 20,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardDesc: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  signOutBtn: {
    width: '100%',
    height: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logsBtn: {
    height: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  logScroll: {
    flex: 1,
    padding: 12,
  },
  logEntry: {
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  logTime: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  logMsg: {
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});
