import React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface ChipProps {
  label: string;
  icon?: React.ReactNode;
  isSelected?: boolean;
  onClick?: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  "aria-label"?: string;
}

export function Chip({
  label,
  icon,
  isSelected,
  onClick,
  onDelete,
  className,
  variant = "outline",
  size = "md",
  disabled,
  "aria-label": ariaLabel,
}: ChipProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-[10px]" : "h-8 px-3 text-xs",
        variant === "outline" && [
          "border font-semibold",
          isSelected
            ? "border-neon-purple/50 bg-neon-purple/10 text-neon-purple shadow-glow-purple scale-[1.02]"
            : "border-border/40 bg-card/60 backdrop-blur-sm text-muted-foreground hover:border-neon-purple/30 hover:text-foreground",
        ],
        variant === "ghost" && [
          "font-semibold",
          isSelected
            ? "bg-neon-purple/10 text-neon-purple"
            : "text-muted-foreground hover:bg-neon-purple/5 hover:text-foreground",
        ],
        className,
      )}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="truncate max-w-[120px]">{label}</span>

      {/* {isSelected && !onDelete && (
        <Check
          size={size === "sm" ? 10 : 12}
          className="stroke-[3] flex-shrink-0 animate-in zoom-in-50 duration-200"
        />
      )} */}

      {onDelete && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onDelete(e);
          }}
          className="hover:bg-foreground/10 rounded-full p-0.5 -mr-1 transition-colors"
        >
          <X size={size === "sm" ? 10 : 12} />
        </span>
      )}
    </button>
  );
}
