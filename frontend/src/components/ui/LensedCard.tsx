import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LensedCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function LensedCard({ children, className, onClick }: LensedCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden bg-white/80 dark:bg-card/40 border-0 ring-1 ring-border shadow-glass backdrop-blur-xl transition-all duration-500 rounded-md",
        className,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none z-0" />

      {children}
    </div>
  );
}
