import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { ChipSelector } from "@/components/ui/ChipSelector";
import type { Tag } from "@/components/ui/ChipSelector";

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
  selection?: "single" | "multi";
  maxVisibleCount?: number;
}

export function PlatformChips({
  platforms,
  selectedPlatforms,
  onToggle,
  selection = "multi",
  maxVisibleCount = 5,
}: PlatformChipsProps) {
  const connectedPlatforms = platforms.filter((p) => p.connected);

  if (connectedPlatforms.length === 0) {
    return (
      <div className="text-xs text-muted-foreground/60 text-center py-4">
        No connected platforms. Connect platforms first.
      </div>
    );
  }

  // Map platforms to the generic Tag format
  const tags: Tag[] = connectedPlatforms.map((p) => ({
    id: p.id,
    label: p.handle || p.name,
    icon: <PlatformLogo platform={p.name.toLowerCase()} size={14} />,
  }));

  return (
    <ChipSelector
      tags={tags}
      selectedIds={selectedPlatforms}
      onSelect={onToggle}
      selection={selection}
      maxVisibleCount={maxVisibleCount}
    />
  );
}
