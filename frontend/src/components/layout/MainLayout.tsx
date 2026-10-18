import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { AnimatePresence } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import { CreatiAgent } from "../ai/CreatiAgent";
import { GlobalSearch } from "./GlobalSearch";
import { useState, useEffect } from "react";
import { useBranding } from "@/hooks/useBranding";

export function MainLayout() {
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  useBranding();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden relative selection:bg-neon-purple/30">
      {/* Structural Depth - Atmospheric Blobs (v14 Parity) */}
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[var(--blob-1)] rounded-full blur-[100px] pointer-events-none dark:mix-blend-screen mix-blend-multiply z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-[var(--blob-2)] rounded-full blur-[100px] pointer-events-none dark:mix-blend-screen mix-blend-multiply z-0" />
      {/* <div className="absolute top-[20%] left-[30%] w-[400px] h-[400px] bg-[var(--blob-3)] rounded-full blur-[80px] pointer-events-none dark:mix-blend-screen mix-blend-multiply z-0" /> */}

      {/* Global Cinematic Noise Overlay */}
      <div className="fixed inset-0 z-[100] pointer-events-none bg-noise opacity-[0.02]" />

      <div className={location.pathname === "/youtube-live" ? "hidden h-full md:flex" : "contents"}><Sidebar /></div>

      <div className="min-w-0 flex-1 flex flex-col h-screen transition-all duration-300 overflow-hidden relative z-10">
        <Header />
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <AnimatePresence mode="wait">
            <Outlet key={location.pathname} />
          </AnimatePresence>
        </main>
      </div>

      <CreatiAgent />
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
}
