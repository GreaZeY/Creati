import React, { useRef } from "react";
import { useStudio } from "../../context/StudioProvider";
import { Music, Layers, Scissors, Wand2 } from "lucide-react";
import { AudioTrackComponent } from "./AudioTrackComponent";

export const TimelineView: React.FC = () => {
  const { state, setCurrentTime } = useStudio();
  const timelineRef = useRef<HTMLDivElement>(null);

  const duration = state.totalDuration || 60;
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
    <div className="h-48 bg-card/80 backdrop-blur-md border-t border-border/40 flex flex-col select-none overflow-hidden">
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
        <div className="flex items-center min-h-[40px] border-b border-border/10 relative group bg-black/5">
          <div className="w-24 shrink-0 flex items-center gap-2 px-3 border-r border-border/10 bg-black/10 h-full">
            <Scissors size={12} className="text-muted-foreground" />
            <span className="text-[9px] font-black uppercase tracking-widest opacity-40">
              Video
            </span>
          </div>
          <div className="flex-1 relative h-full flex items-center">
            {state.videoSegments.map((seg) => (
              <div
                key={seg.id}
                className="absolute h-8 rounded bg-primary/20 border border-primary/40 overflow-hidden group/clip"
                style={{
                  left: `${seg.startTime * pixelsPerSecond}px`,
                  width: `${seg.duration * pixelsPerSecond}px`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent" />
                <div className="absolute inset-y-0 left-0 w-1 bg-primary/40" />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black truncate opacity-60 uppercase tracking-tighter">
                  {seg.url.split("/").pop()}
                </span>
                {seg.filter && (
                  <div className="absolute right-1 top-1 text-[7px] bg-primary/20 px-1 rounded font-bold uppercase">
                    {seg.filter}
                  </div>
                )}
              </div>
            ))}

            {/* Transition Markers */}
            {state.transitions.map((trans) => (
              <div
                key={trans.id}
                className="absolute top-0 bottom-0 w-4 bg-primary/20 hover:bg-primary/40 flex items-center justify-center cursor-pointer border-x border-primary/20"
                style={{ left: `${trans.offset * pixelsPerSecond}px` }}
              >
                <Wand2 size={10} className="text-primary" />
              </div>
            ))}
          </div>
        </div>

        {/* Audio Tracks */}
        <div className="flex flex-col">
          {state.audioTracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center min-h-[40px] border-b border-border/10 relative group bg-cyan-500/5"
            >
              <div className="w-24 shrink-0 flex items-center gap-2 px-3 border-r border-border/10 h-full">
                <Music size={12} className="text-cyan-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400/60">
                  Audio
                </span>
              </div>
              <div className="flex-1 relative h-6 mx-2">
                <AudioTrackComponent
                  track={track}
                  pixelsPerSecond={pixelsPerSecond}
                />
              </div>
            </div>
          ))}

          {state.audioTracks.length === 0 && (
            <div className="h-[40px] flex items-center justify-center border-b border-border/10 border-dashed bg-secondary/5">
              <p className="text-[9px] font-bold text-muted-foreground/20 uppercase tracking-[0.2em]">
                Drag music to this area
              </p>
            </div>
          )}
        </div>

        {/* Overlay Layers Track */}
        <div className="flex items-center min-h-[40px] border-b border-border/10 relative group bg-amber-500/5">
          <div className="w-24 shrink-0 flex items-center gap-2 px-3 border-r border-border/10 h-full">
            <Layers size={12} className="text-amber-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/60">
              Overlays
            </span>
          </div>
          <div className="flex-1 relative h-full flex flex-col gap-1 py-1">
            {state.overlays.map((ov) => (
              <div
                key={ov.id}
                className="h-2 mx-2 rounded bg-amber-500/20 border border-amber-500/30 relative"
                style={{
                  width: `${duration * pixelsPerSecond}px`,
                }}
              >
                <span className="absolute -top-3 left-0 text-[7px] font-bold text-amber-500/40 uppercase tracking-tighter">
                  {ov.type}: {ov.text || "asset"}
                </span>
              </div>
            ))}
            {state.overlays.length === 0 && (
              <div className="h-4 flex items-center px-4 opacity-20">
                <span className="text-[8px] font-bold uppercase tracking-widest">
                  No overlays added
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
