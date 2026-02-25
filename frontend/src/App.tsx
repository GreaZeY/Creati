import { Suspense, lazy, useEffect, useLayoutEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useNavigation,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { GoogleOAuthProvider } from "@react-oauth/google";

// Lazy-loaded pages
const Landing = lazy(() =>
  import("./pages/Landing").then((m) => ({ default: m.Landing })),
);
const Login = lazy(() =>
  import("./pages/Login").then((m) => ({ default: m.Login })),
);
const Register = lazy(() =>
  import("./pages/Register").then((m) => ({ default: m.Register })),
);
const ConnectPlatforms = lazy(() =>
  import("./pages/ConnectPlatforms").then((m) => ({
    default: m.ConnectPlatforms,
  })),
);
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Platforms = lazy(() =>
  import("./pages/Platforms").then((m) => ({ default: m.Platforms })),
);
const Analytics = lazy(() =>
  import("./pages/Analytics").then((m) => ({ default: m.Analytics })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings })),
);
const SettingsMain = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.SettingsMain })),
);
const SettingsSectionPlaceholder = lazy(() =>
  import("./pages/Settings").then((m) => ({
    default: m.SettingsSectionPlaceholder,
  })),
);
const ProfileManager = lazy(() =>
  import("./components/settings/ProfileManager").then((m) => ({
    default: m.ProfileManager,
  })),
);
const WorkspaceManager = lazy(() =>
  import("./components/settings/WorkspaceManager").then((m) => ({
    default: m.WorkspaceManager,
  })),
);
const IdentityManager = lazy(() =>
  import("./components/settings/IdentityManager").then((m) => ({
    default: m.IdentityManager,
  })),
);
const Upload = lazy(() =>
  import("./pages/Upload").then((m) => ({ default: m.Upload })),
);
const Automations = lazy(() =>
  import("./pages/automations/Automations").then((m) => ({
    default: m.Automations,
  })),
);
const UnifiedBuilder = lazy(() =>
  import("./pages/automations/UnifiedBuilder").then((m) => ({
    default: m.UnifiedBuilder,
  })),
);
const QueuedJobs = lazy(() =>
  import("@/pages/QueuedJobs").then((m) => ({ default: m.QueuedJobs })),
);
const BlastBuilder = lazy(() =>
  import("./pages/BlastBuilder").then((m) => ({ default: m.BlastBuilder })),
);
const PostComposer = lazy(() =>
  import("./pages/PostComposer").then((m) => ({ default: m.PostComposer })),
);
const Pricing = lazy(() =>
  import("./pages/Pricing").then((m) => ({ default: m.Pricing })),
);
const WorkspaceSetup = lazy(() =>
  import("./pages/WorkspaceSetup").then((m) => ({ default: m.WorkspaceSetup })),
);
const PlatformCallback = lazy(() =>
  import("./pages/PlatformCallback").then((m) => ({
    default: m.PlatformCallback,
  })),
);
const ConnectClient = lazy(() =>
  import("./pages/ConnectClient").then((m) => ({ default: m.ConnectClient })),
);
const ContentApproval = lazy(() =>
  import("./pages/ContentApproval").then((m) => ({
    default: m.ContentApproval,
  })),
);
const Calendar = lazy(() =>
  import("./pages/Calendar").then((m) => ({ default: m.Calendar })),
);
const SharedReport = lazy(() =>
  import("./pages/SharedReport").then((m) => ({ default: m.SharedReport })),
);
const Invoices = lazy(() =>
  import("./pages/Invoices").then((m) => ({ default: m.Invoices })),
);
const CreativeLab = lazy(() =>
  import("./pages/CreativeLab").then((m) => ({ default: m.CreativeLab })),
);

import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";
import { PageTransition } from "./components/layout/PageTransition";
import { UIProvider, useUI } from "./context/UIContext";
import { ClientProvider } from "./context/ClientContext";
import { BackgroundEffect } from "./components/ui/BackgroundEffect";
import { Toaster } from "./components/ui/Toaster";
import { LoadingBar } from "./components/ui/LoadingBar";
import "./index.css";

import { MainLayout } from "./components/layout/MainLayout";
import { AuthLayout } from "./components/layout/AuthLayout";

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageTracker = () => {
  const { setIsLoading } = useUI();
  const location = useLocation();

  useEffect(() => {
    // Small delay to ensure the bar is visible long enough for the eye
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timeout);
  }, [location.pathname, setIsLoading]);

  return <Outlet />;
};

const RootLayout = () => {
  const { isLoading, setIsLoading } = useUI();
  const navigation = useNavigation();
  const location = useLocation();

  // Use useLayoutEffect for the START signal to ensure it happens BEFORE child useEffects
  useLayoutEffect(() => {
    setIsLoading(true);
  }, [location.pathname, setIsLoading]);

  // Sync state with router-driven navigation (loaders/actions)
  useEffect(() => {
    if (navigation.state === "loading") {
      setIsLoading(true);
    }
  }, [navigation.state, setIsLoading]);

  return (
    <>
      <BackgroundEffect />
      <Toaster />
      <LoadingBar isLoading={isLoading} />
      <Suspense fallback={null}>
        <PageTracker />
      </Suspense>
    </>
  );
};

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/",
        element: (
          <PageTransition>
            <Landing />
          </PageTransition>
        ),
      },
      {
        element: (
          <GoogleOAuthProvider
            clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}
          >
            <AuthLayout />
          </GoogleOAuthProvider>
        ),
        children: [
          {
            path: "login",
            element: (
              <PageTransition>
                <PublicRoute>
                  <Login />
                </PublicRoute>
              </PageTransition>
            ),
          },
          {
            path: "register",
            element: (
              <PageTransition>
                <PublicRoute>
                  <Register />
                </PublicRoute>
              </PageTransition>
            ),
          },
        ],
      },
      {
        path: "connect-client/:token",
        element: (
          <PageTransition>
            <ConnectClient />
          </PageTransition>
        ),
      },
      {
        path: "approve/:token",
        element: (
          <PageTransition>
            <ContentApproval />
          </PageTransition>
        ),
      },
      {
        path: "shared/:clientId",
        element: (
          <PageTransition>
            <SharedReport />
          </PageTransition>
        ),
      },
      {
        element: (
          <ProtectedRoute>
            <ClientProvider>
              <MainLayout />
            </ClientProvider>
          </ProtectedRoute>
        ),
        children: [
          {
            path: "dashboard",
            element: (
              <PageTransition>
                <Dashboard />
              </PageTransition>
            ),
          },
          {
            path: "platforms",
            element: (
              <PageTransition>
                <Platforms />
              </PageTransition>
            ),
          },
          {
            path: "platforms/connect",
            element: (
              <PageTransition>
                <ConnectPlatforms />
              </PageTransition>
            ),
          },
          {
            path: "platforms/:platform/callback",
            element: <PlatformCallback />,
          },
          {
            path: "analytics",
            element: (
              <PageTransition>
                <Analytics />
              </PageTransition>
            ),
          },
          {
            path: "calendar",
            element: (
              <PageTransition>
                <Calendar />
              </PageTransition>
            ),
          },
          {
            path: "invoices",
            element: (
              <PageTransition>
                <Invoices />
              </PageTransition>
            ),
          },
          {
            path: "creative-lab",
            element: (
              <PageTransition>
                <CreativeLab />
              </PageTransition>
            ),
          },
          {
            path: "settings",
            element: (
              <PageTransition>
                <Settings />
              </PageTransition>
            ),
            children: [
              { index: true, element: <SettingsMain /> },
              { path: "profile", element: <ProfileManager /> },
              { path: "workspaces", element: <WorkspaceManager /> },
              { path: "identity", element: <IdentityManager /> },
              { path: "*", element: <SettingsSectionPlaceholder /> },
            ],
          },
          {
            path: "upload",
            element: (
              <PageTransition>
                <Upload />
              </PageTransition>
            ),
          },
          {
            path: "create/:actor",
            element: (
              <PageTransition>
                <PostComposer />
              </PageTransition>
            ),
          },
          {
            path: "automations",
            children: [
              {
                index: true,
                element: (
                  <PageTransition>
                    <Automations />
                  </PageTransition>
                ),
              },
              {
                path: "new",
                element: (
                  <PageTransition>
                    <UnifiedBuilder />
                  </PageTransition>
                ),
              },
              {
                path: "syncs",
                element: <Navigate to="/automations" replace />,
              },
              {
                path: "announcements",
                element: <Navigate to="/automations" replace />,
              },
              {
                path: "syncs/new",
                element: <Navigate to="/automations/new" replace />,
              },
              {
                path: "announcements/new",
                element: <Navigate to="/automations/new" replace />,
              },
            ],
          },
          {
            path: "automation",
            element: <Navigate to="/automations" replace />,
          },
          {
            path: "workflows",
            element: <Navigate to="/automations" replace />,
          },
          {
            path: "push",
            element: (
              <PageTransition>
                <BlastBuilder />
              </PageTransition>
            ),
          },
          {
            path: "queued",
            element: (
              <PageTransition>
                <QueuedJobs />
              </PageTransition>
            ),
          },
          {
            path: "blast/new",
            element: <Navigate to="/blast" replace />,
          },
          {
            path: "pricing",
            element: (
              <PageTransition>
                <Pricing />
              </PageTransition>
            ),
          },
          {
            path: "onboarding",
            element: (
              <PageTransition>
                <WorkspaceSetup />
              </PageTransition>
            ),
          },
        ],
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UIProvider>
          <RouterProvider router={router} />
        </UIProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
