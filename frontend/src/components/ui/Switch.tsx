import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: "sm" | "md" | "lg";
  thumbIconChecked?: React.ReactNode;
  thumbIconUnchecked?: React.ReactNode;
}

const SIZES = {
  sm: {
    container: "h-5 w-9",
    thumb: "h-4 w-4",
    x: 16,
  },
  md: {
    container: "h-6 w-11",
    thumb: "h-5 w-5",
    x: 20,
  },
  lg: {
    container: "h-8 w-14",
    thumb: "h-7 w-7",
    x: 24,
  },
};

export function Switch({
  checked,
  onCheckedChange,
  className,
  size = "md",
  thumbIconChecked,
  thumbIconUnchecked,
  ...props
}: SwitchProps) {
  const styles = SIZES[size];

  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        styles.container,
        checked ? "bg-primary" : "bg-input",
        className,
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "pointer-events-none flex items-center justify-center rounded-full bg-background shadow-lg ring-0",
          styles.thumb,
        )}
        animate={{ x: checked ? styles.x : 0 }}
      >
        {checked ? thumbIconChecked : thumbIconUnchecked}
      </motion.span>
    </button>
  );
}
