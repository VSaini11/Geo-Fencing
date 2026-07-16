import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginUser as apiLoginUser, registerUser as apiRegisterUser, logoutUser as apiLogoutUser } from "../api/authClient";

export type Role = "admin" | "employee";

interface AuthState {
  userName: string | null;
  role: Role | null;
  employeeId: string | null;
  token: string | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  isLoaded: boolean;
  signIn: (userName: string, role: Role, password: string) => Promise<void>;
  signUp: (userName: string, role: Role, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const STORAGE_KEY = "geo-checkin:auth:v2";

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    userName: null,
    role: null,
    employeeId: null,
    token: null,
    isAuthenticated: false,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (mounted) {
        if (value) {
          try {
            const parsed = JSON.parse(value);
            setAuthState({
              userName: parsed.userName,
              role: parsed.role,
              employeeId: parsed.employeeId || null,
              token: parsed.token || null,
              isAuthenticated: !!parsed.token,
            });
          } catch (e) {
            // Fallback
          }
        }
        setIsLoaded(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const signUp = useCallback(async (userName: string, role: Role, password: string) => {
    const trimmedName = userName.trim();
    if (!trimmedName || !password) return;

    const data = await apiRegisterUser(trimmedName, password, role);
    
    const session = { 
      userName: data.user.name, 
      role: data.user.role, 
      employeeId: data.user.employeeId,
      token: data.token 
    };
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    
    setAuthState({
      userName: session.userName,
      role: session.role,
      employeeId: session.employeeId,
      token: session.token,
      isAuthenticated: true,
    });
  }, []);

  const signIn = useCallback(async (userName: string, role: Role, password: string) => {
    const trimmedName = userName.trim();
    if (!trimmedName || !password) return;

    const data = await apiLoginUser(trimmedName, password, role);
    
    const session = { 
      userName: data.user.name, 
      role: data.user.role, 
      employeeId: data.user.employeeId,
      token: data.token 
    };
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    
    setAuthState({
      userName: session.userName,
      role: session.role,
      employeeId: session.employeeId,
      token: session.token,
      isAuthenticated: true,
    });
  }, []);

  const signOut = useCallback(async () => {
    // Try to notify the backend before clearing local state
    if (authState.token) {
      try {
        await apiLogoutUser(authState.token);
      } catch (e) {
        // Ignore error and proceed to local logout
      }
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    setAuthState({
      userName: null,
      role: null,
      employeeId: null,
      token: null,
      isAuthenticated: false,
    });
  }, [authState.token]);

  return (
    <AuthContext.Provider value={{ ...authState, isLoaded, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
