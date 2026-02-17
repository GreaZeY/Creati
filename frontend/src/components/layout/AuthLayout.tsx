import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

export function AuthLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#030712] text-foreground flex items-center justify-center p-4 relative overflow-hidden dark">
      {/* atmospheric blobs - forced dark mode style */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.2, 0.3],
          x: [0, 20, 0],
          y: [0, -20, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#3b82f6] rounded-full blur-[120px] pointer-events-none mix-blend-screen z-0 opacity-30"
      />
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.3, 0.2],
          x: [0, -30, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#8b5cf6] rounded-full blur-[120px] pointer-events-none mix-blend-screen z-0 opacity-20"
      />
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[20%] left-[30%] w-[400px] h-[400px] bg-[#06b6d4] rounded-full blur-[100px] pointer-events-none mix-blend-screen z-0 opacity-10"
      />

      <div className="relative z-10 w-full flex items-center justify-center">
        <AnimatePresence mode="wait">
          <Outlet key={location.pathname} />
        </AnimatePresence>
      </div>
    </div>
  );
}
