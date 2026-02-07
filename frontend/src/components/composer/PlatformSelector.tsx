import { PlatformLogo } from "../platforms/PlatformLogo";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Platform {
  id: string;
  name: string;
  connected: boolean;
  accountId?: number;
  handle?: string;
}

interface PlatformSelectorProps {
  platforms: Platform[];
  selectedPlatforms: string[];
  onToggle: (platformId: string) => void;
  className?: string;
}

export function PlatformSelector({
  platforms,
  selectedPlatforms,
  onToggle,
  className,
}: PlatformSelectorProps) {
  const connectedPlatforms = platforms.filter((p) => p.connected);

  if (connectedPlatforms.length === 0) {
    return (
      <div className="p-4 bg-muted/30 rounded-xl border border-dashed border-border text-center">
        <p className="text-sm text-muted-foreground">
          No platforms connected.{" "}
          <a href="/platforms/connect" className="text-primary hover:underline">
            Connect one now
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {connectedPlatforms.map((platform) => {
        const isSelected = selectedPlatforms.includes(platform.id);
        return (
          <button
            key={platform.id}
            type="button"
            onClick={() => onToggle(platform.id)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-xl border-0 transition-all font-bold text-xs uppercase tracking-wider ring-1 shadow-sm",
              isSelected
                ? "bg-primary text-primary-foreground ring-primary shadow-primary/20 scale-105"
                : "bg-muted/50 text-muted-foreground/60 ring-border hover:bg-muted hover:text-muted-foreground hover:scale-105",
            )}
          >
            <PlatformLogo
              platform={platform.name.toLowerCase()}
              size={16}
              className={cn(
                "transition-colors",
                isSelected
                  ? "text-primary-foreground"
                  : "text-muted-foreground/60",
              )}
            />
            <span>{platform.name}</span>
            {isSelected && <Check size={14} />}
          </button>
        );
      })}
    </div>
  );
}
