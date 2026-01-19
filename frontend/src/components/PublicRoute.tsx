import { useAuth } from '@/hooks/useAuth.tsx';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

interface PublicRouteProps {
    children: ReactNode;
}

/**
 * Public route wrapper
 * Redirects to dashboard if already authenticated
 */
export const PublicRoute = ({ children }: PublicRouteProps) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-gray-400">Loading...</div>
            </div>
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};
