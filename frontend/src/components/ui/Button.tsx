import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center whitespace-nowrap text-xs font-bold uppercase tracking-wider transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neon-purple disabled:pointer-events-none disabled:opacity-50 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white dark:bg-white dark:text-black hover:bg-primary/90 dark:hover:bg-slate-200 shadow-glow-purple dark:shadow-[0_0_20px_rgba(255,255,255,0.3)]",
        destructive: "bg-red-500 text-white hover:bg-red-600 shadow-glow-pink",
        outline:
          "text-foreground dark:text-white border border-border dark:border-white/10 bg-transparent hover:bg-secondary/10 dark:hover:bg-white/5 hover:border-primary/20 dark:hover:border-white/20",
        secondary:
          "text-foreground dark:text-white bg-secondary/10 dark:bg-white/5 border border-border dark:border-white/10 hover:bg-secondary/20 dark:hover:bg-white/10 hover:border-primary/20 dark:hover:border-white/20",
        premium:
          "bg-gradient-to-r from-neon-purple to-neon-blue text-white shadow-glow-purple hover:scale-[1.02] active:scale-[0.98]",
        ghost:
          "text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-secondary/20 dark:hover:bg-white/5",
        link: "text-primary underline-offset-4 hover:underline lowercase tracking-normal font-medium",
        neon: "bg-neon-purple text-black font-black shadow-glow-purple hover:bg-neon-purple/90",
        lime: "bg-neon-lime text-black font-black shadow-glow-lime hover:bg-neon-lime/90",
      },
      size: {
        default: "h-12 px-8 rounded-full",
        sm: "h-9 rounded-full px-4 text-[10px]",
        lg: "h-14 rounded-full px-10 text-sm",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  loadingText?: string;
  successText?: string;
  errorText?: string;
}

// Custom forwardRef for motion button
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      isSuccess = false,
      isError = false,
      loadingText = "Processing...",
      successText = "Done",
      errorText = "Try again",
      children,
      ...props
    },
    ref,
  ) => {
    // If asChild (Slot), we skip the motion wrapper to avoid conflicts,
    // effectively degrading to a static button for those rare cases.
    if (asChild) {
      const Comp = Slot;
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    // Determine effective variant for motion styles
    const isPrimary = variant === "default" || !variant;

    return (
      <motion.button
        ref={ref as any}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={isLoading || isSuccess || props.disabled}
        // Motion Props
        whileHover={
          isPrimary && !isLoading && !isSuccess && !isError
            ? {
                // Removed glow and lift as per feedback
                // Subtle brightness bump is standard, but user said "no glow".
                // We'll rely on CSS class hover state for color fill.
              }
            : {}
        }
        whileTap={
          isPrimary && !isLoading && !isSuccess && !isError
            ? {
                scale: 0.98,
                // Removed shadow tightening if user wants "no glow", but "physics" implies scale/press.
                // Kept scale only for pure physical feel without shadow play.
              }
            : {}
        }
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        // Error Shake
        animate={isError ? { x: [0, -10, 10, -10, 10, 0] } : {}}
        {...(props as HTMLMotionProps<"button">)}
      >
        {/* Background Color Shift for Success/Error - Only for primary variant */}
        {isPrimary && (
          <motion.div
            className="absolute inset-0 z-0 bg-primary"
            animate={{
              opacity: 1, // Base
              backgroundColor: isSuccess
                ? "hsl(var(--success))"
                : isError
                  ? "hsl(var(--destructive))"
                  : "hsl(var(--primary))",
            }}
            transition={{ duration: 0.3 }}
          />
        )}

        {/* Content Container */}
        <span className="relative z-10 flex items-center justify-center gap-2">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2"
              >
                {loadingText}
                {/* Progress Bar inside button */}
                <div className="absolute bottom-0 left-0 h-[2px] bg-primary-foreground/20 w-full">
                  <motion.div
                    className="h-full bg-primary-foreground/40"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{
                      duration: 2,
                      ease: "linear",
                      repeat: Infinity,
                    }}
                  />
                </div>
              </motion.span>
            ) : isSuccess ? (
              <motion.span
                key="success"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-2 font-bold"
              >
                <Check className="w-4 h-4" /> {successText}
              </motion.span>
            ) : isError ? (
              <motion.span
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 font-bold text-destructive-foreground"
              >
                <X className="w-4 h-4" /> {errorText}
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2"
              >
                {children}
              </motion.span>
            )}
          </AnimatePresence>
        </span>

        {/* Premium Sheen Animation */}
        {!isLoading &&
          !isSuccess &&
          !isError &&
          variant !== "ghost" &&
          variant !== "link" && (
            <motion.div
              className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-20 w-[40%]"
              initial={{ x: "-150%" }}
              animate={{ x: "400%" }}
              transition={{
                repeat: Infinity,
                duration: 2.5,
                repeatDelay: 4,
                ease: "easeInOut",
              }}
            />
          )}
      </motion.button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
