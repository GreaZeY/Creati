import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { AnimatePresence } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";

export function MainLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-screen transition-all duration-300 overflow-hidden ml-64">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8">
            <AnimatePresence mode="wait">
              <Outlet key={location.pathname} />
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
