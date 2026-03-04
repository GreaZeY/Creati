import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTenancy } from "@/context/TenancyContext";

export function AuthLayout() {
  const location = useLocation();
  const { branding, isCustomBranded } = useTenancy();

  return (
    <div className="min-h-screen bg-black text-foreground flex justify-center p-4 relative overflow-hidden dark">
      {/* atmospheric blobs - forced dark mode style */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.7, 0.8, 0.7],
          x: [0, 20, 0],
          y: [0, -20, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[var(--blob-1)]  rounded-full blur-[120px] pointer-events-none mix-blend-screen z-0"
      />
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.7, 0.8, 0.7],
          x: [0, -30, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-[var(--blob-2)] rounded-full blur-[120px] pointer-events-none mix-blend-screen z-0"
      />
      {/* <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[20%] left-[30%] w-[400px] h-[400px] bg-[#06b6d4] rounded-full blur-[100px] pointer-events-none mix-blend-screen z-0 opacity-10"
      /> */}

      <div className="relative z-10 w-full flex flex-col items-center justify-center">
        {/* Persistent Logo Bar */}
        <div className="mb-12 flex flex-col items-center">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="h-12 w-auto object-contain mb-4"
            />
          ) : (
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center font-bold text-white text-xl">
                {branding?.name ? branding.name.charAt(0) : "C"}
              </div>
              <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                {branding?.name || "Creati"}
              </span>
            </div>
          )}
          {!isCustomBranded && (
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground opacity-50">
              Powered by Creati
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          <Outlet key={location.pathname} />
        </AnimatePresence>
      </div>
    </div>
  );
}
