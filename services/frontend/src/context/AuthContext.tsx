// src/context/AuthContext.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import Cookies from "js-cookie";
import { User, LoginCredentials, RegisterData } from "@/types";
import * as api from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, try to load the user from the existing token
  useEffect(() => {
    const loadUser = async () => {
      const token = Cookies.get("token");
      if (token) {
        try {
          const currentUser = await api.getCurrentUser();
          setUser(currentUser);
        } catch {
          Cookies.remove("token");
        }
      }
      setIsLoading(false);
    };
    loadUser();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const response = await api.login(credentials);
    Cookies.set("token", response.access_token, { expires: 7 });
    const currentUser = await api.getCurrentUser();
    setUser(currentUser);
  };

  const register = async (data: RegisterData) => {
    const response = await api.register(data);
    Cookies.set("token", response.access_token, { expires: 7 });
    const currentUser = await api.getCurrentUser();
    setUser(currentUser);
  };

  const logout = () => {
    Cookies.remove("token");
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook — saves every consumer from writing useContext(AuthContext)
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
