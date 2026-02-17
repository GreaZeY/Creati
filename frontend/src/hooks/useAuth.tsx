import { createContext, useContext, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { authAPI, type User } from "@/lib/api";

interface AuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) => Promise<void>;
  googleLogin: (
    idToken: string,
    firstName?: string,
    lastName?: string,
  ) => Promise<void>;
  logout: () => void;
  loading: boolean;
  user: User | null;
}

// Redundant User interface removed, using import from lib/api

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Auth provider component
 * Manages authentication state globally via Secure Cookies
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Check session with backend on mount
    const checkAuth = async () => {
      // Optimization: if no CSRF token cookie, we likely aren't logged in
      const hasCookie = document.cookie
        .split(";")
        .some((c) => c.trim().startsWith("csrf_token="));
      if (!hasCookie) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await authAPI.check();
        setIsAuthenticated(true);
        setUser(data?.data?.user);
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await authAPI.login(email, password);
    queryClient.clear();
    // Cookie is set by backend
    setIsAuthenticated(true);
    setUser(data?.data?.user);
  };

  const register = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) => {
    const { data } = await authAPI.register(
      email,
      password,
      firstName,
      lastName,
    );
    queryClient.clear();
    // Cookie is set by backend
    setIsAuthenticated(true);
    setUser(data?.data?.user);
  };

  const googleLogin = async (
    idToken: string,
    firstName?: string,
    lastName?: string,
  ) => {
    const { data } = await authAPI.googleLogin(idToken, firstName, lastName);
    queryClient.clear();
    setIsAuthenticated(true);
    setUser(data?.data?.user);
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error("Logout failed", error);
    }
    queryClient.clear();
    setIsAuthenticated(false);
    setUser(null);
    // Let the router handle redirect if needed, or api.ts interceptor
    // window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        login,
        register,
        googleLogin,
        logout,
        loading,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Auth hook for consuming auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
