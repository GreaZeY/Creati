import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ConnectPlatforms } from "./pages/ConnectPlatforms";
import { Dashboard } from "./pages/Dashboard";
import { Platforms } from "./pages/Platforms";
import { Analytics } from "./pages/Analytics";
import {
  Settings,
  SettingsMain,
  SettingsSectionPlaceholder,
} from "./pages/Settings";
import { WorkspaceManager } from "./components/settings/WorkspaceManager";
import { Upload } from "./pages/Upload";
import { Automations } from "./pages/automations/Automations";
import { SyncsList } from "./pages/automations/SyncsList";
import { AnnouncementsList } from "./pages/automations/AnnouncementsList";
import { UnifiedBuilder } from "./pages/automations/UnifiedBuilder";
import { ArchiveBlast } from "./pages/ArchiveBlast";
import { BlastBuilder } from "./pages/BlastBuilder";
import { Pricing } from "./pages/Pricing";
import { WorkspaceSetup } from "./pages/WorkspaceSetup";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";
import { PageTransition } from "./components/layout/PageTransition";
import { UIProvider } from "./context/UIContext";
import { ClientProvider } from "./context/ClientContext";
import { BackgroundEffect } from "./components/ui/BackgroundEffect";
import { Toaster } from "./components/ui/Toaster";
import "./index.css";

import { MainLayout } from "./components/layout/MainLayout";
import { AuthLayout } from "./components/layout/AuthLayout";
import { PlatformCallback } from "./pages/PlatformCallback";

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter([
  {
    element: (
      <>
        <BackgroundEffect />
        <Toaster />
        <Outlet />
      </>
    ),
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
        element: <AuthLayout />,
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
        element: (
          <ProtectedRoute>
            <MainLayout />
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
            path: "settings",
            element: (
              <PageTransition>
                <Settings />
              </PageTransition>
            ),
            children: [
              { index: true, element: <SettingsMain /> },
              { path: "workspaces", element: <WorkspaceManager /> },
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
            path: "automation",
            element: <Navigate to="/automations/syncs" replace />,
          },
          {
            path: "workflows",
            element: <Navigate to="/automations/syncs" replace />,
          },
          {
            path: "automations",
            element: (
              <PageTransition>
                <Automations />
              </PageTransition>
            ),
            children: [
              {
                index: true,
                element: <Navigate to="syncs" replace />,
              },
              {
                path: "syncs",
                element: <SyncsList />,
              },
              {
                path: "announcements",
                element: <AnnouncementsList />,
              },
            ],
          },
          {
            path: "automations/syncs/new",
            element: (
              <PageTransition>
                <UnifiedBuilder type="sync" />
              </PageTransition>
            ),
          },
          {
            path: "automations/announcements/new",
            element: (
              <PageTransition>
                <UnifiedBuilder type="announcement" />
              </PageTransition>
            ),
          },
          {
            path: "blast",
            element: (
              <PageTransition>
                <ArchiveBlast />
              </PageTransition>
            ),
          },
          {
            path: "blast/new",
            element: (
              <PageTransition>
                <BlastBuilder />
              </PageTransition>
            ),
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
          <ClientProvider>
            <RouterProvider router={router} />
          </ClientProvider>
        </UIProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
