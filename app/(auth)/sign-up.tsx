import React, { useState } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Link } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import { useAuth, Role } from "@/hooks/useAuth";

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useAuth();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name.trim() || !password) return;
    
    setIsLoading(true);
    try {
      await signUp(name, role, password);
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Registration Failed", error.message);
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
              <Feather name="user-plus" size={32} color={colors.primaryForeground} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Join GeoCheckin today.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200)} style={styles.form}>
            <BlurView intensity={60} tint="dark" style={[styles.card, { borderColor: colors.border }]}>
              
              <Text style={[styles.label, { color: colors.foreground }]}>Full Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', borderColor: colors.border }]}
                placeholder="Enter your full name"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', borderColor: colors.border }]}
                placeholder="Create a password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />



              <TouchableOpacity 
                style={[styles.signInBtn, { backgroundColor: name.trim() && password ? colors.primary : colors.muted, marginTop: role === 'employee' ? 16 : 0 }]}
                onPress={handleSignUp}
                disabled={!name.trim() || !password || isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <>
                    <Text style={{ color: name.trim() && password ? colors.primaryForeground : colors.mutedForeground, fontWeight: '700', fontSize: 16 }}>
                      Sign Up
                    </Text>
                    <Feather name="arrow-right" size={20} color={name.trim() && password ? colors.primaryForeground : colors.mutedForeground} />
                  </>
                )}
              </TouchableOpacity>
              
              <View style={styles.footer}>
                <Text style={{ color: colors.mutedForeground }}>Already have an account? </Text>
                <Link href="/(auth)/sign-in" asChild>
                  <TouchableOpacity>
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>Log In</Text>
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
  roleContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  roleBtn: { flex: 1, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 16, gap: 8 },
  roleText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  infoBox: { flexDirection: 'row', padding: 12, borderRadius: 12, alignItems: 'center', gap: 10, marginBottom: 16 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  signInBtn: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, gap: 8 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 }
});
