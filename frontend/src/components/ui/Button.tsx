import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "text-white relative inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary shadow-sm font-semibold",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        outline:
          "text-primary border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "text-primary bg-transparent border border-border hover:bg-accent hover:border-primary/30 hover:text-slate-950",
        ghost: "text-foreground hover:bg-accent/10 border border-transparent hover:border-primary/50 hover:text-accent",
        link: "text-primary text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[45px] px-6 rounded-[8px]",
        sm: "h-9 rounded-sm px-3",
        lg: "h-14 rounded-md px-8 text-md font-medium",
        icon: "h-10 w-10 rounded-[6px]",
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

        {/* Idle Sheen (Only for Primary, when not interacting) */}
        {/* {isPrimary && !isLoading && !isSuccess && !isError && (
                    <motion.div
                        className="absolute inset-0 z-1 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                        initial={{ x: "-100%" }}
                        animate={{ x: "200%" }}
                        transition={{
                            repeat: Infinity,
                            duration: 1.5,
                            repeatDelay: 5, // 6-8 seconds cycle implies ~6s wait
                            ease: "linear"
                        }}
                    />
                )} */}
      </motion.button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
