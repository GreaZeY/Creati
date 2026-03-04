import React, { useRef } from "react";
import { useStudio } from "../../context/StudioProvider";
import { Music, Layers, Scissors } from "lucide-react";

export const TimelineView: React.FC = () => {
  const { state, setCurrentTime } = useStudio();
  const timelineRef = useRef<HTMLDivElement>(null);

  const duration = state.video.duration || 60;
  const pixelsPerSecond = 20;
  const width = duration * pixelsPerSecond;

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const time = x / pixelsPerSecond;
    setCurrentTime(Math.max(0, Math.min(time, duration)));
  };

  return (
    <div className="h-48 bg-card/80 backdrop-blur-md border-t border-border/40 flex flex-col select-none">
      {/* Ruler */}
      <div
        className="h-6 border-b border-border/20 relative overflow-hidden flex items-center bg-black/5"
        onClick={handleTimelineClick}
        ref={timelineRef}
        style={{ cursor: "pointer" }}
      >
        <div style={{ width: `${width}px` }} className="relative h-full">
          {Array.from({ length: Math.ceil(duration) }).map((_, i) => (
            <div
              key={i}
              className="absolute bottom-0 border-l border-muted-foreground/30 h-1.5"
              style={{ left: `${i * pixelsPerSecond}px` }}
            >
              {i % 5 === 0 && (
                <span className="absolute bottom-2 left-1 text-[8px] font-mono text-muted-foreground/60">
                  {i}s
                </span>
              )}
            </div>
          ))}
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-primary z-50 shadow-[0_0_8px_rgba(var(--primary),0.5)]"
            style={{ left: `${state.currentTime * pixelsPerSecond}px` }}
          >
            <div className="absolute top-0 -left-1 w-2 h-2 bg-primary rounded-full" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {/* Video Track */}
        <div className="flex items-center min-h-[40px] border-b border-border/10 relative group">
          <div className="w-24 shrink-0 flex items-center gap-2 px-3 border-r border-border/10 bg-black/10 h-full">
            <Scissors size={12} className="text-muted-foreground" />
            <span className="text-[9px] font-black uppercase tracking-widest opacity-40">
              Video
            </span>
          </div>
          <div
            className="flex-1 relative h-8 mx-2 rounded bg-primary/10 border border-primary/20 overflow-hidden"
            style={{
              left: `${state.video.trimStart * pixelsPerSecond}px`,
              width: `${(state.video.trimEnd - state.video.trimStart) * pixelsPerSecond}px`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-bold truncate opacity-60">
              {state.video.url.split("/").pop()}
            </span>
          </div>
        </div>

        {/* Audio Tracks */}
        {state.audioTracks.map((track, i) => (
          <div
            key={track.id}
            className="flex items-center min-h-[40px] border-b border-border/10 relative group bg-cyan-500/5"
          >
            <div className="w-24 shrink-0 flex items-center gap-2 px-3 border-r border-border/10 h-full">
              <Music size={12} className="text-cyan-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400/60">
                Audio {i + 1}
              </span>
            </div>
            <div
              className="flex-1 relative h-6 mx-2 rounded bg-cyan-500/10 border border-cyan-500/20"
              style={{
                left: `${track.startTime * pixelsPerSecond}px`,
                width: `${track.duration * pixelsPerSecond}px`,
              }}
            >
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-bold truncate text-cyan-400/60">
                {track.name}
              </span>
            </div>
          </div>
        ))}

        {/* Placeholder for adding audio */}
        {state.audioTracks.length === 0 && (
          <div className="h-10 flex items-center justify-center border-b border-border/10 border-dashed">
            <p className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-[0.2em]">
              Drop music here
            </p>
          </div>
        )}

        {/* Overlay Layers Track */}
        <div className="flex items-center min-h-[40px] border-b border-border/10 relative group bg-amber-500/5">
          <div className="w-24 shrink-0 flex items-center gap-2 px-3 border-r border-border/10 h-full">
            <Layers size={12} className="text-amber-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/60">
              Overlays
            </span>
          </div>
          <div className="flex-1 relative h-full">
            {state.overlays.map((ov) => (
              <div
                key={ov.id}
                className="absolute top-2 h-4 rounded bg-amber-500/20 border border-amber-500/30"
                style={{
                  left: `0px`, // Overlays currently span whole video in simple model
                  width: `${duration * pixelsPerSecond}px`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
