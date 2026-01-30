import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  thumbIconChecked?: React.ReactNode;
  thumbIconUnchecked?: React.ReactNode;
}

export function Switch({ checked, onCheckedChange, className, thumbIconChecked, thumbIconUnchecked }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
        className
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "pointer-events-none flex items-center justify-center h-7 w-7 rounded-full bg-background shadow-lg ring-0"
        )}
        animate={{ x: checked ? 24 : 0 }}
      >
        {checked ? thumbIconChecked : thumbIconUnchecked}
      </motion.span>
    </button>
  );
}
