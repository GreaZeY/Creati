import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface Platform {
  id: string;
  name: string;
  handle?: string;
}

interface PreviewPaneProps {
  selectedPlatformIds: string[];
  platforms: Platform[];
  postText: string;
  media: Array<{ id: string; url: string; type: "image" | "video" }>;
}

type DeviceType = "desktop" | "mobile";

export function PreviewPane({
  selectedPlatformIds,
  platforms,
  postText,
  media,
}: PreviewPaneProps) {
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [activeTab, setActiveTab] = useState<string>(
    selectedPlatformIds[0] || "",
  );

  // Get selected platform objects
  const selectedPlatforms = platforms.filter((p) =>
    selectedPlatformIds.includes(p.id),
  );

  // Update active tab when platforms change
  if (
    selectedPlatformIds.length > 0 &&
    !selectedPlatformIds.includes(activeTab)
  ) {
    setActiveTab(selectedPlatformIds[0]);
  }

  if (selectedPlatformIds.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground/40">
        <div className="text-center">
          <Monitor size={48} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-bold uppercase tracking-wider">
            Select platforms to preview
          </p>
        </div>
      </div>
    );
  }

  // Find active platform data
  const activePlatform = platforms.find((p) => p.id === activeTab);

  return (
    <div className="flex-1 flex flex-col bg-secondary/10">
      {/* Header: Tabs + Device Toggle */}
      <div className="h-12 border-b border-border/40 flex items-center justify-between px-4 bg-card/20">
        {/* Platform Tabs */}
        <div className="flex gap-2">
          {selectedPlatforms.map((platform) => (
            <button
              key={platform.id}
              onClick={() => setActiveTab(platform.id)}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
                activeTab === platform.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
            >
              {platform.name}
            </button>
          ))}
        </div>

        {/* Device Toggle */}
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5">
          <button
            onClick={() => setDevice("desktop")}
            className={cn(
              "h-7 w-7 rounded flex items-center justify-center transition-colors",
              device === "desktop"
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Desktop view"
          >
            <Monitor size={14} />
          </button>
          <button
            onClick={() => setDevice("mobile")}
            className={cn(
              "h-7 w-7 rounded flex items-center justify-center transition-colors",
              device === "mobile"
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Mobile view"
          >
            <Smartphone size={14} />
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 p-6 overflow-auto flex items-start justify-center">
        <div
          className={cn(
            "transition-all",
            device === "desktop" ? "w-full max-w-[590px]" : "w-[375px]",
          )}
        >
          {/* Platform-specific preview */}
          <div className="bg-card rounded-xl border border-border/40 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20" />
              <div>
                <p className="font-bold text-sm">
                  {activePlatform?.name || "Platform Name"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {activePlatform?.handle
                    ? `@${activePlatform.handle}`
                    : "@handle"}{" "}
                  · now
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {postText || "Your post will appear here..."}
            </p>
            {media.length > 0 && (
              <div className="mt-3 grid gap-2">
                {media.map((m) => (
                  <img
                    key={m.id}
                    src={m.url}
                    alt=""
                    className="rounded-lg w-full"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
