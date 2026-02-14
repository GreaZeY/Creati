import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { authAPI } from "@/lib/api";

interface AuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  user: User | null;
}

interface User {
  id: number;
  email: string;
  name: string;
  profilePicture: string;
}

// ... imports logic fixed

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Auth provider component
 * Manages authentication state globally via Secure Cookies
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check session with backend on mount
    const checkAuth = async () => {
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
    await authAPI.login(email, password);
    // Cookie is set by backend
    setIsAuthenticated(true);
  };

  const register = async (email: string, password: string) => {
    await authAPI.register(email, password);
    // Cookie is set by backend
    setIsAuthenticated(true);
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error("Logout failed", error);
    }
    setIsAuthenticated(false);
    // Let the router handle redirect if needed, or api.ts interceptor
    // window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, login, register, logout, loading, user }}
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
