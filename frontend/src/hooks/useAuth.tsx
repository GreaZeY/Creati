import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authAPI } from '@/lib/api';

interface AuthContextType {
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Auth provider component
 * Manages authentication state globally
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for existing token on mount
        const token = localStorage.getItem('auth_token');
        setIsAuthenticated(!!token);
        setLoading(false);
    }, []);

    const login = async (email: string, password: string) => {
        const response = await authAPI.login(email, password);
        const { token } = response.data;
        localStorage.setItem('auth_token', token);
        setIsAuthenticated(true);
    };

    const register = async (email: string, password: string) => {
        const response = await authAPI.register(email, password);
        const { token } = response.data;
        localStorage.setItem('auth_token', token);
        setIsAuthenticated(true);
    };

    const logout = () => {
        authAPI.logout();
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value= {{ isAuthenticated, login, register, logout, loading }
}>
    { children }
    </AuthContext.Provider>
  );
};

/**
 * Auth hook for consuming auth context
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
