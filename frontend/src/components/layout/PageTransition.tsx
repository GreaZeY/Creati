import { motion } from "framer-motion";
import { type ReactNode } from "react";

const pageVariants = {
  initial: {
    opacity: 0,
    y: 12, // Slide up 12px
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: "easeOut",
      when: "beforeChildren",
      staggerChildren: 0.08,
    },
  },
  exit: {
    opacity: 0,
    y: -12, // Slight slide up on exit too
    transition: {
      duration: 0.1,
      ease: "easeIn",
    },
  },
};

export const PageTransition = ({ children }: { children: ReactNode }) => {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants as any}
      className="w-full h-full flex flex-col flex-1 min-h-0"
    >
      {children}
    </motion.div>
  );
};
