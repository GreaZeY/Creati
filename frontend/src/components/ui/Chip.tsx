import React from "react";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

export interface ChipProps {
  label: string;
  icon?: React.ReactNode;
  isSelected?: boolean;
  onClick?: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md";
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
}: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full transition-all duration-200",
        size === "sm" ? "h-7 px-2.5 text-[10px]" : "h-8 px-3 text-xs",
        variant === "outline" && [
          "border font-medium",
          isSelected
            ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/20"
            : "border-border/40 bg-background/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
        ],
        variant === "ghost" && [
          "font-medium",
          isSelected
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
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
