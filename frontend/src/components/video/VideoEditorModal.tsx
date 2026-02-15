import { useState, useRef, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Play, Pause, X, Type, Scissors, Check } from "lucide-react";

export interface OverlayConfig {
  type: "text";
  text: string;
  x: string;
  y: string;
  size: number;
  color: string;
}

export interface ProcessingSettings {
  trim_start?: number;
  trim_end?: number;
  overlays: OverlayConfig[];
}

interface VideoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: {
    id: string;
    title: string;
    url?: string; // If available directly
    previewUrl?: string; // Or thumbnail/preview
    // In Creati, we might not have direct URL if it's external.
    // But for editing we need a source.
    // BlastBuilder has "pastVideos" which likely have a URL or we need to fetch it.
    // If external (YouTube), we can't play it in video tag easily without CORS or proxy.
    // We might need a proxy stream.
    // But for MVP, let's assume we have a playable URL or just use placeholder for UI.
    sourcePlatform?: string;
  };
  initialSettings?: ProcessingSettings;
  onSave: (id: string, settings: ProcessingSettings) => void;
}

export function VideoEditorModal({
  isOpen,
  onClose,
  video,
  initialSettings,
  onSave,
}: VideoEditorModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  // Settings
  const [range, setRange] = useState<[number, number]>([0, 100]); // Percentage or seconds? Seconds better.
  const [overlays, setOverlays] = useState<OverlayConfig[]>(
    initialSettings?.overlays || [],
  );

  // Initial load
  useEffect(() => {
    if (isOpen) {
      // Reset or load settings
      if (
        initialSettings?.trim_start !== undefined &&
        initialSettings?.trim_end !== undefined
      ) {
        // modifying range when duration is known
      }
    }
  }, [isOpen, initialSettings]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      if (
        initialSettings?.trim_start !== undefined &&
        initialSettings?.trim_end !== undefined
      ) {
        setRange([initialSettings.trim_start, initialSettings.trim_end]);
      } else {
        setRange([0, dur]);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const curr = videoRef.current.currentTime;
      // Loop if out of range
      if (curr > range[1]) {
        videoRef.current.currentTime = range[0];
        videoRef.current.play();
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        if (
          videoRef.current.currentTime < range[0] ||
          videoRef.current.currentTime >= range[1]
        ) {
          videoRef.current.currentTime = range[0];
        }
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSave = () => {
    onSave(video.id, {
      trim_start: range[0],
      trim_end: range[1],
      overlays,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editor Studio">
      <div className="flex flex-col gap-4 min-w-[600px] min-h-[400px]">
        {/* Video Player */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden group">
          <video
            ref={videoRef}
            src={video.url} // We need a valid URL here.
            // If it's a YouTube video, this won't work directly.
            // For now assuming we have a proxy or cached URL.
            className="w-full h-full object-contain"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
          />

          {/* Overlays Visualizer */}
          <div className="absolute inset-0 pointer-events-none">
            {overlays.map((ov, idx) => (
              <div
                key={idx}
                className="absolute text-white font-bold drop-shadow-md"
                style={{
                  left: "50%", // Simplified positioning for visualization
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  fontSize: `${ov.size}px`,
                  color: ov.color,
                }}
              >
                {ov.text}
              </div>
            ))}
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={togglePlay}
              className="p-3 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/40 text-white transition-colors"
            >
              {isPlaying ? (
                <Pause fill="currentColor" />
              ) : (
                <Play fill="currentColor" />
              )}
            </button>
          </div>
        </div>

        {/* Trimmer */}
        <div className="p-4 bg-secondary/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
              <Scissors size={14} /> Trimming
            </div>
            <div className="text-xs font-mono">
              {range[0].toFixed(1)}s - {range[1].toFixed(1)}s
              <span className="ml-2 opacity-50">
                ({(range[1] - range[0]).toFixed(1)}s)
              </span>
            </div>
          </div>

          {/* Simple Range Inputs for MVP reliability */}
          <div className="relative h-6 w-full">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={range[0]}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (val < range[1] - 0.5) setRange([val, range[1]]);
              }}
              className="absolute w-full z-20 opacity-50 cursor-pointer pointer-events-auto"
            />
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={range[1]}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (val > range[0] + 0.5) setRange([range[0], val]);
              }}
              className="absolute w-full z-20 opacity-50 cursor-pointer pointer-events-auto"
            />

            {/* Visual Track */}
            <div className="absolute top-1/2 -translate-y-1/2 h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/20"
                style={{
                  marginLeft: `${(range[0] / (duration || 1)) * 100}%`,
                  width: `${((range[1] - range[0]) / (duration || 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Overlays */}
        <div className="p-4 bg-secondary/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
              <Type size={14} /> Overlays
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => {
                setOverlays([
                  ...overlays,
                  {
                    type: "text",
                    text: "New Text",
                    x: "(w-text_w)/2",
                    y: "(h-text_h)/2",
                    size: 24,
                    color: "white",
                  },
                ]);
              }}
            >
              + Add text
            </Button>
          </div>

          <div className="space-y-2 max-h-[100px] overflow-y-auto">
            {overlays.map((ov, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Input
                  value={ov.text}
                  onChange={(e) => {
                    const newOv = [...overlays];
                    newOv[idx].text = e.target.value;
                    setOverlays(newOv);
                  }}
                  className="h-8 text-xs bg-background/50"
                />
                <Input
                  type="number"
                  value={ov.size}
                  onChange={(e) => {
                    const newOv = [...overlays];
                    newOv[idx].size = parseInt(e.target.value);
                    setOverlays(newOv);
                  }}
                  className="h-8 w-16 text-xs bg-background/50"
                  placeholder="Size"
                />
                <button
                  onClick={() => {
                    const newOv = overlays.filter((_, i) => i !== idx);
                    setOverlays(newOv);
                  }}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {overlays.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No overlays added.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Check size={16} /> Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
