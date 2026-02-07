import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Platform {
  id: string;
  name: string;
  handle?: string;
  connected: boolean;
}

interface PlatformChipsProps {
  platforms: Platform[];
  selectedPlatforms: string[];
  onToggle: (platformId: string) => void;
}

export function PlatformChips({
  platforms,
  selectedPlatforms,
  onToggle,
}: PlatformChipsProps) {
  const connectedPlatforms = platforms.filter((p) => p.connected);

  if (connectedPlatforms.length === 0) {
    return (
      <div className="text-xs text-muted-foreground/60 text-center py-4">
        No connected platforms. Connect platforms first.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {connectedPlatforms.map((platform) => {
        const isSelected = selectedPlatforms.includes(platform.id);
        return (
          <button
            key={platform.id}
            onClick={() => onToggle(platform.id)}
            className={cn(
              "h-8 px-3 rounded-full border flex items-center gap-2",
              "transition-all text-xs font-medium",
              isSelected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/40 hover:border-primary/40 text-muted-foreground",
            )}
          >
            <PlatformLogo platform={platform.name.toLowerCase()} size={14} />
            <span className="truncate max-w-[100px]">
              {platform.handle || platform.name}
            </span>
            {isSelected && <Check size={12} className="stroke-[3]" />}
          </button>
        );
      })}
    </div>
  );
}
