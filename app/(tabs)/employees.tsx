import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRouter } from "expo-router";

import { deleteEmployee, fetchEmployees, registerUser } from "@/api/authClient";
import { useAuth } from "@/hooks/useAuth";
import { useColors } from "@/hooks/useColors";
import { useListCheckIns } from "@/hooks/useQueries";

type Employee = {
  _id: string;
  name: string;
  employeeId: string;
  createdAt: string;
  isLoggedOut?: boolean;
};

export default function EmployeesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, role } = useAuth();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { data: allCheckIns = [] } = useListCheckIns();

  // Add Employee state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const loadEmployees = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchEmployees(token);
      setEmployees(data);
    } catch (error) {
      console.log("Failed to fetch employees:", error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const handleDeleteEmployee = (id: string, name: string) => {
    Alert.alert("Delete Employee", `Are you sure you want to completely delete ${name} and all their logs?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          if (!token) return;
          try {
            await deleteEmployee(token, id);
            loadEmployees();
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to delete employee");
          }
        }
      }
    ]);
  };

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleCreateEmployee = async () => {
    if (!newName.trim() || !newPassword) {
      Alert.alert("Error", "Name and password are required.");
      return;
    }

    setIsCreating(true);
    try {
      // Call register API directly instead of the context signUp to avoid logging the admin out
      await registerUser(newName.trim(), newPassword, 'employee');

      Alert.alert("Success", "Employee created successfully!");
      setIsAdding(false);
      setNewName("");
      setNewPassword("");

      // Refresh the employee list
      loadEmployees();
    } catch (err: any) {
      Alert.alert("Failed to Create", err.message);
    } finally {
      setIsCreating(false);
    }
  };

  if (role !== 'admin') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.foreground }}>Access Denied</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: colors.foreground }]}>Employees</Text>

        {!isAdding && (
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => setIsAdding(true)}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={16} color={colors.primaryForeground} />
            <Text style={[styles.addButtonText, { color: colors.primaryForeground }]}>Add new</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {isAdding && (
          <Animated.View
            entering={SlideInDown.springify().damping(15).stiffness(120)}
            exiting={SlideOutDown.duration(200)}
            style={[styles.addCardWrapper, { bottom: Platform.OS === 'ios' ? 110 : 90 }]}
          >
            <BlurView
              intensity={80}
              tint="dark"
              experimentalBlurMethod="dimezisBlurView"
              style={[styles.addCard, { borderColor: colors.border, backgroundColor: 'rgba(0,0,0,0.65)' }]}
            >
              <View style={styles.addHeader}>
                <Text style={[styles.addCardTitle, { color: '#fff' }]}>New Employee</Text>
                <TouchableOpacity onPress={() => setIsAdding(false)} style={styles.closeBtn}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ paddingBottom: 10, flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={[styles.addCardDesc, { color: 'rgba(255,255,255,0.7)' }]}>
                  Create an account for a new employee. They will be assigned a unique ID automatically.
                </Text>

                <TextInput
                  style={[styles.input, { backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', borderColor: colors.border }]}
                  placeholder="Full Name"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={newName}
                  onChangeText={setNewName}
                />

                <TextInput
                  style={[styles.input, { backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', borderColor: colors.border }]}
                  placeholder="Temporary Password"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
                  onPress={handleCreateEmployee}
                  disabled={isCreating}
                  activeOpacity={0.8}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <>
                      <Feather name="user-plus" size={18} color={colors.primaryForeground} />
                      <Text style={{ color: colors.primaryForeground, fontWeight: '600', fontSize: 16 }}>Create Employee</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </BlurView>
          </Animated.View>
        )}

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={employees}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => {
              const isActive = allCheckIns.some((c: any) => c.status === "active" && c.userName === item.name);
              return (
                <Animated.View entering={FadeInDown.delay(index * 100)}>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/employee/${item.name}`)}>
                    <View style={[styles.empItem, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                      <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
                          {item.name.charAt(0).toUpperCase()}
                        </Text>
                        <View style={[styles.statusDot, { backgroundColor: isActive ? '#22c55e' : '#64748b' }]} />
                      </View>
                      <View style={styles.empInfo}>
                        <Text style={[styles.empName, { color: colors.foreground }]}>{item.name}</Text>
                        <Text style={[styles.empId, { color: colors.mutedForeground }]}>
                          ID: {item.employeeId} · {item.isLoggedOut ? "Logged out" : (isActive ? "Checked in" : "Off duty")}
                        </Text>
                      </View>
                      {role === 'admin' && (
                        <TouchableOpacity
                          style={{ padding: 8, marginRight: 8 }}
                          onPress={() => handleDeleteEmployee(item._id, item.name)}
                        >
                          <Feather name="trash-2" size={20} color={colors.destructive} />
                        </TouchableOpacity>
                      )}
                      <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            }}
            ListEmptyComponent={() => (
              <Animated.View entering={FadeIn} style={styles.emptyState}>
                <View style={[styles.emptyIconWrap, { backgroundColor: colors.secondary }]}>
                  <Feather name="users" size={32} color={colors.primary} />
                </View>
                <Text style={[styles.emptyText, { color: colors.foreground }]}>No employees found.</Text>
                <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Employees will appear here once they register.</Text>
              </Animated.View>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 24,
  },
  header: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 6,
  },
  addButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  addCardWrapper: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 100,
    maxHeight: '90%',
    flexShrink: 1,
  },
  addCard: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    maxHeight: '100%',
    flexShrink: 1,
  },
  addHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  closeBtn: {
    padding: 4,
  },
  addCardTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.3,
  },
  addCardDesc: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    fontSize: 15,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 8,
  },
  empItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
    marginBottom: 12,
    borderWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#1e1e1e', // Dark border to blend with dark mode
  },
  empInfo: {
    flex: 1,
    marginLeft: 16,
  },
  empName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  empId: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 30,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  }
});
