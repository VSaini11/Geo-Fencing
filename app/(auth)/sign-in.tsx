import React, { useState } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Link } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import { useAuth, Role } from "@/hooks/useAuth";

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    if (!name.trim() || !password) return;
    
    setIsLoading(true);
    try {
      await signIn(name, role, password);
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
          
          <Animated.View entering={FadeInDown.delay(100)} style={styles.headerWrap}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primary }]}>
              <Feather name="map-pin" size={32} color={colors.primaryForeground} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>GeoCheckin</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Sign in to your account.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200)} style={styles.form}>
            <BlurView intensity={60} tint="dark" style={[styles.card, { borderColor: colors.border }]}>
              
              <Text style={[styles.label, { color: colors.foreground }]}>Your Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', borderColor: colors.border }]}
                placeholder="Enter your full name"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={name}
                onChangeText={setName}
                autoCapitalize="none"
              />

              <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', borderColor: colors.border }]}
                placeholder="Enter your password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>Login As</Text>
              <View style={styles.roleContainer}>
                <TouchableOpacity 
                  style={[
                    styles.roleBtn, 
                    role === "employee" ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: 'transparent', borderColor: colors.border }
                  ]}
                  onPress={() => setRole("employee")}
                  activeOpacity={0.8}
                >
                  <Feather name="user" size={20} color={role === "employee" ? colors.primaryForeground : colors.mutedForeground} />
                  <Text style={[styles.roleText, { color: role === "employee" ? colors.primaryForeground : colors.mutedForeground }]}>Employee</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.roleBtn, 
                    role === "admin" ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: 'transparent', borderColor: colors.border }
                  ]}
                  onPress={() => setRole("admin")}
                  activeOpacity={0.8}
                >
                  <Feather name="shield" size={20} color={role === "admin" ? colors.primaryForeground : colors.mutedForeground} />
                  <Text style={[styles.roleText, { color: role === "admin" ? colors.primaryForeground : colors.mutedForeground }]}>Admin</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.signInBtn, { backgroundColor: name.trim() && password ? colors.primary : colors.muted }]}
                onPress={handleSignIn}
                disabled={!name.trim() || !password || isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <>
                    <Text style={{ color: name.trim() && password ? colors.primaryForeground : colors.mutedForeground, fontWeight: '700', fontSize: 16 }}>
                      Sign In
                    </Text>
                    <Feather name="arrow-right" size={20} color={name.trim() && password ? colors.primaryForeground : colors.mutedForeground} />
                  </>
                )}
              </TouchableOpacity>
              
              <View style={styles.footer}>
                <Text style={{ color: colors.mutedForeground }}>Don't have an account? </Text>
                <Link href={"/(auth)/sign-up" as any} asChild>
                  <TouchableOpacity>
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>Register</Text>
                  </TouchableOpacity>
                </Link>
              </View>

            </BlurView>
          </Animated.View>

        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24 },
  headerWrap: { alignItems: 'center', marginBottom: 40 },
  iconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 36, fontFamily: "Inter_700Bold", letterSpacing: -1, marginBottom: 8 },
  subtitle: { fontSize: 16, fontFamily: "Inter_400Regular" },
  form: { width: '100%' },
  card: { padding: 24, borderRadius: 24, borderWidth: 1, overflow: "hidden" },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { height: 56, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, fontSize: 16, fontFamily: "Inter_500Medium" },
  roleContainer: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  roleBtn: { flex: 1, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 16, gap: 8 },
  roleText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  signInBtn: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, gap: 8 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 }
});
