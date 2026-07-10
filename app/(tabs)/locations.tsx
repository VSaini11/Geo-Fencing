import React, { useState } from "react";
import { StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown, FadeIn, Layout, SlideInDown, SlideOutDown } from "react-native-reanimated";
import Slider from "@react-native-community/slider";

import { useColors } from "@/hooks/useColors";
import { useListLocations, useCreateLocation, useUpdateLocation, useDeleteLocation, getListLocationsQueryKey, useListEmployees } from "@/hooks/useQueries";
import { useQueryClient } from "@tanstack/react-query";
import { RadarCircle } from "@/components/RadarCircle";

export default function LocationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  
  const { data: locations, isLoading } = useListLocations();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();

  const { data: employees, isLoading: isLoadingEmployees } = useListEmployees();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [radius, setRadius] = useState("100");
  const [isCapturing, setIsCapturing] = useState(false);
  const [coords, setCoords] = useState<{latitude: number, longitude: number} | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [showEmpList, setShowEmpList] = useState(false);

  const handleGetLocation = async () => {
    setIsCapturing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "Location permission is required to capture current position.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setCoords({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsCapturing(false);
    }
  };

  const openAddModal = () => {
    setEditingLocationId(null);
    setName("");
    setRadius("100");
    setCoords(null);
    setSelectedEmployees([]);
    setShowEmpList(false);
    setIsModalVisible(true);
  };

  const handleEdit = (loc: any) => {
    setEditingLocationId(loc.id || loc._id);
    setName(loc.name);
    setRadius(loc.radiusMeters.toString());
    setCoords({ latitude: loc.latitude, longitude: loc.longitude });
    setSelectedEmployees(loc.assignedEmployees || []);
    setShowEmpList(false);
    setIsModalVisible(true);
  };

  const handleSaveLocation = async () => {
    if (!name || !radius || !coords) {
      Alert.alert("Error", "Name, radius, and location capture are required");
      return;
    }

    try {
      if (editingLocationId) {
        await updateLocation.mutateAsync({
          id: editingLocationId,
          data: {
            name,
            latitude: coords.latitude,
            longitude: coords.longitude,
            radiusMeters: parseInt(radius, 10),
            assignedEmployees: selectedEmployees
          }
        });
      } else {
        await createLocation.mutateAsync({
          name,
          latitude: coords.latitude,
          longitude: coords.longitude,
          radiusMeters: parseInt(radius, 10),
          assignedEmployees: selectedEmployees
        });
      }
      
      queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
      setIsModalVisible(false);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Location", "Are you sure you want to delete this assigned location?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive", 
        onPress: async () => {
          await deleteLocation.mutateAsync(id);
          queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
        }
      }
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: colors.foreground }]}>Locations</Text>
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={openAddModal}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
          <Text style={[styles.addButtonText, { color: colors.primaryForeground }]}>Add New</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Modal 
          visible={isModalVisible} 
          animationType="slide"
          onRequestClose={() => setIsModalVisible(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={[styles.addCard, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
              <View style={styles.addHeader}>
                <TouchableOpacity onPress={() => setIsModalVisible(false)} style={[styles.backBtnPill, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                  <Feather name="chevron-left" size={20} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={[styles.addCardTitle, { color: colors.foreground }]}>{editingLocationId ? "Edit location" : "Add location"}</Text>
                <View style={{ width: 40 }} />
              </View>

              <ScrollView 
                showsVerticalScrollIndicator={false}
                bounces={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
                keyboardShouldPersistTaps="handled"
              >
                {/* Location Name Section */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>LOCATION NAME</Text>
                  <TextInput
                    style={[styles.premiumInput, { backgroundColor: 'rgba(255,255,255,0.05)', color: colors.foreground, borderColor: 'rgba(255,255,255,0.1)' }]}
                    placeholder="e.g. Trigya office"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                {/* Location Selection Section */}
                <View style={[styles.sectionBox, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <View style={[styles.locIconWrap, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                      <Feather name="map-pin" size={18} color={coords ? colors.primary : colors.mutedForeground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.boxTitle, { color: colors.foreground }]}>{coords ? "Location set" : "Location not set"}</Text>
                      <Text style={[styles.boxSub, { color: colors.mutedForeground }]}>
                        {coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : "Use your current position as the check-in point"}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={[styles.dashedBtn, { borderColor: colors.primary + '50' }]}
                    onPress={handleGetLocation}
                    disabled={isCapturing}
                  >
                    {isCapturing ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Feather name="crosshair" size={16} color={colors.primary} style={{ marginRight: 8 }} />
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>
                          {coords ? "Update my current location" : "Use my current location"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Radius Section */}
                <View style={[styles.sectionBox, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={[styles.boxTitle, { color: colors.foreground, marginBottom: 0 }]}>Check-in radius</Text>
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>{radius} m</Text>
                  </View>
                  
                  <Slider
                    style={{ width: '100%', height: 40 }}
                    minimumValue={5}
                    maximumValue={1000}
                    step={5}
                    value={Number(radius) || 100}
                    onValueChange={(val) => setRadius(val.toString())}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor="rgba(255,255,255,0.1)"
                    thumbTintColor={colors.primary}
                  />

                  <Text style={[styles.boxSub, { color: colors.mutedForeground, marginTop: 4 }]}>
                    Employees checking in beyond this distance from the pinned point will be flagged.
                  </Text>
                </View>

                {/* Assign Employees Section */}
                <View style={[styles.sectionBox, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }]}>
                  <Text style={[styles.boxTitle, { color: colors.foreground }]}>Assign to</Text>
                  
                  <View style={styles.pillsRow}>
                    {selectedEmployees.map((empName) => (
                      <TouchableOpacity 
                        key={empName}
                        style={[styles.empPill, { borderColor: colors.primary + '50' }]}
                        onPress={() => setSelectedEmployees(prev => prev.filter(n => n !== empName))}
                      >
                        <View style={[styles.empPillAvatar, { backgroundColor: colors.primary }]}>
                          <Text style={{ color: colors.primaryForeground, fontWeight: 'bold', fontSize: 12 }}>{empName.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={{ color: colors.foreground, fontWeight: '500', marginLeft: 8 }}>{empName}</Text>
                      </TouchableOpacity>
                    ))}

                    <TouchableOpacity 
                      style={[styles.addPill, { borderColor: 'rgba(255,255,255,0.1)' }]}
                      onPress={() => setShowEmpList(!showEmpList)}
                    >
                      <Feather name="plus" size={14} color={colors.mutedForeground} />
                      <Text style={{ color: colors.mutedForeground, fontWeight: '500', marginLeft: 6 }}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  {showEmpList && (
                    <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 16, gap: 8 }}>
                      {isLoadingEmployees ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : employees?.filter((e: any) => !selectedEmployees.includes(e.name)).length === 0 ? (
                        <Text style={{ color: colors.mutedForeground }}>All employees assigned.</Text>
                      ) : (
                        employees?.filter((e: any) => !selectedEmployees.includes(e.name)).map((emp: any) => (
                          <TouchableOpacity 
                            key={emp.name}
                            style={{ padding: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12 }}
                            onPress={() => setSelectedEmployees(prev => [...prev, emp.name])}
                          >
                            <Text style={{ color: colors.foreground }}>+ {emp.name}</Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}
                </View>

              </ScrollView>

              {/* Flex Save Button */}
              <View style={[styles.saveBtnWrapper, { backgroundColor: colors.background, paddingBottom: insets.bottom || 20 }]}>
                <TouchableOpacity 
                  style={[styles.premiumSaveBtn, { backgroundColor: (!name || !coords || !radius) ? 'rgba(255,255,255,0.1)' : colors.primary }]}
                  onPress={handleSaveLocation}
                  disabled={!name || !coords || !radius}
                >
                  <Feather name="check" size={18} color={(!name || !coords || !radius) ? colors.mutedForeground : colors.primaryForeground} style={{ marginRight: 8 }} />
                  <Text style={{ color: (!name || !coords || !radius) ? colors.mutedForeground : colors.primaryForeground, fontWeight: '600', fontSize: 16 }}>Save location</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={locations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(index * 100)} layout={Layout.springify()}>
                <View style={[styles.locItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <RadarCircle
                    size={64}
                    radiusMeters={item.radiusMeters}
                    distanceMeters={0}
                    bearingDeg={0}
                    isInside={true}
                    centerLabel=""
                  />
                  <View style={styles.locInfo}>
                    <Text style={[styles.locName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.locCoords, { color: colors.mutedForeground }]}>
                      {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                      <Text style={[styles.badgeText, { color: colors.secondaryForeground }]}>
                        Radius: {item.radiusMeters}m
                      </Text>
                    </View>
                    {item.assignedEmployees && item.assignedEmployees.length > 0 && (
                      <Text 
                        style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 8 }}
                        numberOfLines={2}
                      >
                        Assigned to: {item.assignedEmployees.join(", ")}
                      </Text>
                    )}
                  </View>
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { marginRight: 8 }]}
                      onPress={() => handleEdit(item)}
                    >
                      <View style={{ backgroundColor: colors.primary + '15', padding: 10, borderRadius: 12 }}>
                        <Feather name="edit-2" size={18} color={colors.primary} />
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleDelete(item.id)}
                    >
                      <View style={{ backgroundColor: colors.destructive + '15', padding: 10, borderRadius: 12 }}>
                        <Feather name="trash-2" size={18} color={colors.destructive} />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            )}
            ListEmptyComponent={() => (
              <Animated.View entering={FadeIn} style={styles.emptyState}>
                <View style={[styles.emptyIconWrap, { backgroundColor: colors.secondary }]}>
                  <Feather name="map" size={32} color={colors.primary} />
                </View>
                <Text style={[styles.emptyText, { color: colors.foreground }]}>No locations assigned yet.</Text>
                <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Add a location to enable auto check-ins for users within a specific radius.</Text>
                
                <TouchableOpacity 
                  style={[styles.emptyAddButton, { backgroundColor: colors.primary }]}
                  onPress={openAddModal}
                  activeOpacity={0.8}
                >
                  <Feather name="plus" size={18} color={colors.primaryForeground} />
                  <Text style={[styles.addButtonText, { color: colors.primaryForeground }]}>Add First Location</Text>
                </TouchableOpacity>
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
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  addButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },
  addCard: {
    flex: 1,
  },
  addHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  backBtnPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCardTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  premiumInput: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  sectionBox: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  boxTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  boxSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  locIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dashedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  empPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  empPillAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  saveBtnWrapper: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  premiumSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 8,
  },
  locItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  locInfo: {
    flex: 1,
    marginLeft: 4,
  },
  locName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  locCoords: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontVariant: ["tabular-nums"],
    marginBottom: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    padding: 4,
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
    marginBottom: 32,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    gap: 8,
  }
});
