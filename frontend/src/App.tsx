import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ConnectPlatforms } from './pages/ConnectPlatforms';
import { Dashboard } from './pages/Dashboard';
import { Platforms } from './pages/Platforms';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Upload } from './pages/Upload';
import { Automation } from './pages/Automation';
import { RuleBuilder } from './pages/RuleBuilder';
import { Pricing } from './pages/Pricing';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicRoute } from './components/PublicRoute';
import { PageTransition } from './components/layout/PageTransition';
import { UIProvider } from './context/UIContext';
import { BackgroundEffect } from './components/ui/BackgroundEffect';
import { Toaster } from './components/ui/Toaster';
import './index.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

import { AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Breadcrumbs } from './components/layout/Breadcrumbs';
import { cn } from './lib/utils';

const AppRoutes = () => {
  const location = useLocation();

  // Define which pages show the sidebar
  const protectedPaths = ['/dashboard', '/platforms', '/platforms/connect', '/analytics', '/settings', '/upload', '/automation', '/automation/new', '/pricing'];
  const isProtectedPath = protectedPaths.includes(location.pathname);

  // Auth pages (Login, Register) - No sidebar but use layout styling
  const authPaths = ['/login', '/register'];
  const isAuthPath = authPaths.includes(location.pathname);

  const showSidebar = isProtectedPath;
  const useLayoutWrapper = isProtectedPath || isAuthPath;

  const content = (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Landing Page */}
        <Route path="/" element={<PageTransition><Landing /></PageTransition>} />

        {/* Public Auth Routes */}
        <Route path="/login" element={<PageTransition><PublicRoute><Login /></PublicRoute></PageTransition>} />
        <Route path="/register" element={<PageTransition><PublicRoute><Register /></PublicRoute></PageTransition>} />

        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><PageTransition><Dashboard /></PageTransition></ProtectedRoute>} />

        {/* Platforms & Nested Connect */}
        <Route path="/platforms" element={<ProtectedRoute><PageTransition><Platforms /></PageTransition></ProtectedRoute>} />
        <Route path="/platforms/connect" element={<ProtectedRoute><PageTransition><ConnectPlatforms /></PageTransition></ProtectedRoute>} />

        <Route path="/analytics" element={<ProtectedRoute><PageTransition><Analytics /></PageTransition></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><PageTransition><Settings /></PageTransition></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><PageTransition><Upload /></PageTransition></ProtectedRoute>} />
        <Route path="/automation" element={<ProtectedRoute><PageTransition><Automation /></PageTransition></ProtectedRoute>} />
        <Route path="/automation/new" element={<ProtectedRoute><PageTransition><RuleBuilder /></PageTransition></ProtectedRoute>} />
        <Route path="/pricing" element={<ProtectedRoute><PageTransition><Pricing /></PageTransition></ProtectedRoute>} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );

  if (!useLayoutWrapper) {
    return content;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {showSidebar && <Sidebar />}

      <main className={cn(
        "flex-1 p-8 min-h-screen relative transition-all duration-300",
        showSidebar ? "ml-60" : "ml-0"
      )}>
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs />
          {content}
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UIProvider>
          <BrowserRouter>
            <BackgroundEffect />
            <Toaster />
            <AppRoutes />
          </BrowserRouter>
        </UIProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
