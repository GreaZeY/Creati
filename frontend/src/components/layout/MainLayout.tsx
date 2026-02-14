import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { AnimatePresence } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";

export function MainLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden relative selection:bg-neon-purple/30">
      {/* Structural Depth - Atmospheric Blobs (v14 Parity) */}
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[var(--blob-1)] rounded-full blur-[100px] pointer-events-none dark:mix-blend-screen mix-blend-multiply z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-[var(--blob-2)] rounded-full blur-[100px] pointer-events-none dark:mix-blend-screen mix-blend-multiply z-0" />
      <div className="absolute top-[20%] left-[30%] w-[400px] h-[400px] bg-[var(--blob-3)] rounded-full blur-[80px] pointer-events-none dark:mix-blend-screen mix-blend-multiply z-0" />

      {/* Global Cinematic Noise Overlay */}
      <div className="fixed inset-0 z-[100] pointer-events-none bg-noise opacity-[0.02]" />

      <Sidebar />

      <div className="flex-1 flex flex-col h-screen transition-all duration-300 overflow-hidden relative z-10">
        <Header />
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <AnimatePresence mode="wait">
            <Outlet key={location.pathname} />
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
