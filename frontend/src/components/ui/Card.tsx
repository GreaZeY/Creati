import React from "react";
import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";

interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: React.ReactNode;
  hover?: boolean;
  glow?: boolean;
}

/**
 * Card component with optional hover animation
 * Follows dark/light theme system
 */
export const Card: React.FC<CardProps> = ({
  children,
  hover = false,
  glow = false,
  className = "",
  ...props
}) => {
  return (
    <motion.div
      whileHover={hover ? { y: -4, borderColor: "rgba(255,255,255,0.2)" } : {}}
      className={`
                relative rounded-[32px] overflow-hidden glass-panel p-6
                transition-colors duration-500 shadow-glass group/card
                ${className}
            `}
      transition={{ duration: 0.3, ease: "easeOut" }}
      {...props}
    >
      {/* Inner depth layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none z-0" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex flex-col space-y-1.5 p-6 mb-2 ${className || ""}`}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={`text-xl font-black font-display tracking-tight text-foreground dark:text-white ${className || ""}`}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={`text-xs font-bold text-muted-foreground/60 uppercase tracking-widest ${className || ""}`}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={`px-6 pb-6 ${className || ""}`} {...props} />
));
CardContent.displayName = "CardContent";
