import { Sidebar } from "./Sidebar";
import { motion } from "framer-motion";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Global Nervous System Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] animate-pulse" />
        <div
          className="absolute bottom-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-cyan-500/5 blur-[100px] animate-pulse"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute top-[40%] left-[60%] w-[20%] h-[20%] rounded-full bg-pink-500/5 blur-[80px] animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <Sidebar />

      <main className="pl-64 min-h-screen relative z-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="max-w-7xl mx-auto p-12 md:p-16 lg:p-20"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
