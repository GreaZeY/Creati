import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface LoadingBarProps {
  isLoading: boolean;
}

/**
 * Cyber-Premium Top Loading Bar
 * Animates a gradient-filled bar at the very top of the screen.
 */
export const LoadingBar = ({ isLoading }: LoadingBarProps) => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isLoading) {
      setVisible(true);
      setProgress(10);

      // Simulate progress progression
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + Math.random() * 15;
        });
      }, 200);
    } else {
      setProgress(100);
      const timeout = setTimeout(() => {
        setVisible(false);
        const resetTimeout = setTimeout(() => {
          setProgress(0);
        }, 300); // Shorter reset
        return () => clearTimeout(resetTimeout);
      }, 200); // Shorter fade delay
      return () => clearTimeout(timeout);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3, delay: 0.2 } }}
          className="fixed top-0 left-0 right-0 z-[2147483647] h-[1.5px] pointer-events-none"
        >
          <motion.div
            className="h-full bg-gradient-to-r from-neon-purple via-neon-blue to-neon-lime shadow-[0_0_15px_rgba(185,70,255,1),0_0_30px_rgba(0,240,255,0.4)]"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{
              type: "spring",
              stiffness: 40,
              damping: 15,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
