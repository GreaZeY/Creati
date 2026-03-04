import React, { useRef } from "react";
import { useStudio } from "../../context/StudioProvider";
import { Music, Layers, Scissors, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/Slider";

export function TimelineView() {
  const { state, updateVideoSegment, setCurrentTime, selectElement } =
    useStudio();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = React.useState(25);

  // Transient state for "Delayed Cut" dragging
  const [dragState, setDragState] = React.useState<{
    id: string;
    type: "left" | "right";
    tempTrimStart: number;
    tempDuration: number;
    initialStartTime: number;
  } | null>(null);

  const activeSegmentId =
    state.videoSegments.find(
      (seg) =>
        state.currentTime >= seg.startTime &&
        state.currentTime < seg.startTime + seg.duration,
    )?.id || state.videoSegments[0]?.id;

  const duration = state.totalDuration || 60;
  const totalWidth = duration * pixelsPerSecond;

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const time = x / pixelsPerSecond;
    setCurrentTime(Math.max(0, Math.min(time, duration)));
  };

  return (
    <div className="h-56 bg-card/80 backdrop-blur-md border-t border-border/40 flex flex-col select-none overflow-hidden">
      {/* Timeline Header / Toolbar */}
      <div className="h-10 px-4 border-b border-border/10 flex items-center justify-between bg-black/10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Scissors size={14} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Timeline
            </span>
          </div>
          <div className="h-4 w-px bg-border/20" />
          <span className="text-[10px] font-mono text-primary font-bold">
            {state.currentTime.toFixed(2)}s / {duration.toFixed(2)}s
          </span>
        </div>

        {/* Zoom Control */}
        <div className="flex items-center gap-3 w-64">
          <span className="text-[8px] font-bold uppercase text-muted-foreground/40">
            Zoom
          </span>
          <Slider
            min={5}
            max={150}
            step={1}
            value={pixelsPerSecond}
            onValueChange={(val: number) => setPixelsPerSecond(val)}
            className="flex-1"
          />
          <button
            onClick={() => setPixelsPerSecond(25)}
            className="p-1 hover:bg-white/10 rounded-md transition-colors"
          >
            <RotateCcw size={10} className="text-muted-foreground/60" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-x-auto custom-scrollbar"
        ref={timelineRef}
      >
        <div
          className="relative min-h-full bg-black/5"
          style={{ width: `${totalWidth + 1000}px` }} // Significant padding for scrolling comfort
          onClick={handleTimelineClick}
        >
          {/* Ruler */}
          <div className="h-6 border-b border-border/20 relative">
            {Array.from({ length: Math.ceil(duration) + 10 }).map((_, i) => (
              <div
                key={i}
                className={`absolute bottom-0 border-l border-muted-foreground/20 ${i % 5 === 0 ? "h-3" : "h-1.5"}`}
                style={{ left: `${i * pixelsPerSecond}px` }}
              >
                {i % 5 === 0 && (
                  <span className="absolute bottom-4 left-1 text-[8px] font-mono text-muted-foreground/60">
                    {i}s
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="py-6 space-y-8">
            {/* Video Track */}
            <div className="relative h-16 w-full">
              {state.videoSegments.map((seg, idx) => {
                const isActive = activeSegmentId === seg.id;
                const isDraggingThis = dragState?.id === seg.id;

                // Use transient dragState values if we are currently dragging this segment
                const displayTrimStart = isDraggingThis
                  ? dragState!.tempTrimStart
                  : seg.trimStart;
                const displayDuration = isDraggingThis
                  ? dragState!.tempDuration
                  : seg.duration;

                // Visually, if we trim the LEFT, the clip's left edge moves locally in its slot
                const leftShift =
                  isDraggingThis && dragState?.type === "left"
                    ? (displayTrimStart - seg.trimStart) * pixelsPerSecond
                    : 0;

                const framesInClip = Math.floor(displayDuration * 2);

                return (
                  <div
                    key={seg.id}
                    className={`absolute top-0 bottom-0 transition-shadow ${
                      isActive
                        ? "z-20 ring-[4px] ring-primary ring-inset rounded-lg shadow-2xl shadow-primary/20"
                        : "z-10 bg-black/40 rounded-lg overflow-hidden border border-white/5"
                    }`}
                    style={{
                      left: `${seg.startTime * pixelsPerSecond + leftShift}px`,
                      width: `${displayDuration * pixelsPerSecond}px`,
                      backgroundColor: isActive
                        ? "transparent"
                        : `hsla(${idx * 40}, 70%, 50%, 0.15)`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentTime(seg.startTime);
                      selectElement(null);
                    }}
                  >
                    {/* Filmstrip Pattern overlay */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden flex gap-1.5 p-1 px-4">
                      {Array.from({ length: Math.max(1, framesInClip) }).map(
                        (_, i) => (
                          <div
                            key={i}
                            className="shrink-0 w-12 h-full border border-white/5 rounded-sm bg-white/5 flex items-center justify-center"
                          >
                            <div className="w-4 h-4 rounded-full bg-white/5" />
                          </div>
                        ),
                      )}
                    </div>

                    {/* Clip Info Badge */}
                    <div className="absolute top-1 left-2 flex items-center gap-2 pointer-events-none">
                      <div className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
                        <Scissors size={8} className="text-white/40" />
                        <span className="text-[7px] font-black uppercase text-white/80 tracking-widest truncate">
                          Clip {idx + 1}
                        </span>
                      </div>
                    </div>

                    <div className="absolute bottom-1 right-2 pointer-events-none">
                      <span className="text-[7px] font-mono text-white/30 bg-black/20 px-1 rounded">
                        {displayDuration.toFixed(2)}s
                      </span>
                    </div>

                    {/* Endcap Trimming Handles */}
                    {isActive && (
                      <>
                        {/* Left Endcap */}
                        <div
                          className="absolute -left-1 top-0 bottom-0 w-5 cursor-col-resize z-50 flex items-center justify-center group/handle"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const startX = e.clientX;
                            const initialTrimStart = seg.trimStart;
                            const initialDuration = seg.duration;
                            const initialStartTime = seg.startTime;

                            setDragState({
                              id: seg.id,
                              type: "left",
                              tempTrimStart: initialTrimStart,
                              tempDuration: initialDuration,
                              initialStartTime,
                            });

                            const onMouseMove = (moveEvent: MouseEvent) => {
                              const deltaX = moveEvent.clientX - startX;
                              const deltaTime = deltaX / pixelsPerSecond;
                              const newTrimStart = Math.max(
                                0,
                                initialTrimStart + deltaTime,
                              );
                              const shiftedDelta =
                                newTrimStart - initialTrimStart;
                              const newDuration = Math.max(
                                0.1,
                                initialDuration - shiftedDelta,
                              );

                              setDragState((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      tempTrimStart: newTrimStart,
                                      tempDuration: newDuration,
                                    }
                                  : null,
                              );

                              // Live Preview: Update playhead locally
                              setCurrentTime(initialStartTime + shiftedDelta);
                            };

                            const onMouseUp = (upEvent: MouseEvent) => {
                              window.removeEventListener(
                                "mousemove",
                                onMouseMove,
                              );
                              window.removeEventListener("mouseup", onMouseUp);

                              const deltaX = upEvent.clientX - startX;
                              const deltaTime = deltaX / pixelsPerSecond;
                              const finalTrimStart = Math.max(
                                0,
                                initialTrimStart + deltaTime,
                              );
                              const finalDuration = Math.max(
                                0.1,
                                initialDuration -
                                  (finalTrimStart - initialTrimStart),
                              );

                              // NOW trigger the global update and timeline recalculation
                              updateVideoSegment(seg.id, {
                                trimStart: finalTrimStart,
                                duration: finalDuration,
                              });
                              setDragState(null);
                            };

                            window.addEventListener("mousemove", onMouseMove);
                            window.addEventListener("mouseup", onMouseUp);
                          }}
                        >
                          <div className="w-2 h-10 bg-white rounded-full shadow-xl border-2 border-primary" />
                        </div>

                        {/* Right Endcap */}
                        <div
                          className="absolute -right-1 top-0 bottom-0 w-5 cursor-col-resize z-50 flex items-center justify-center group/handle"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const startX = e.clientX;
                            const initialDuration = seg.duration;
                            const initialStartTime = seg.startTime;

                            setDragState({
                              id: seg.id,
                              type: "right",
                              tempTrimStart: seg.trimStart,
                              tempDuration: initialDuration,
                              initialStartTime,
                            });

                            const onMouseMove = (moveEvent: MouseEvent) => {
                              const deltaX = moveEvent.clientX - startX;
                              const deltaTime = deltaX / pixelsPerSecond;
                              const newDuration = Math.max(
                                0.1,
                                initialDuration + deltaTime,
                              );

                              setDragState((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      tempDuration: newDuration,
                                    }
                                  : null,
                              );

                              // Trigger silent update so useVideoEditor can see the trim for preview
                              updateVideoSegment(
                                seg.id,
                                {
                                  duration: newDuration,
                                },
                                { silent: true },
                              );

                              // Live Preview: Update playhead locally
                              setCurrentTime(initialStartTime + newDuration);
                            };

                            const onMouseUp = (upEvent: MouseEvent) => {
                              window.removeEventListener(
                                "mousemove",
                                onMouseMove,
                              );
                              window.removeEventListener("mouseup", onMouseUp);

                              const deltaX = upEvent.clientX - startX;
                              const finalDuration = Math.max(
                                0.1,
                                initialDuration + deltaX / pixelsPerSecond,
                              );

                              // NOW trigger the global update and timeline recalculation
                              updateVideoSegment(seg.id, {
                                duration: finalDuration,
                              });
                              setDragState(null);
                            };

                            window.addEventListener("mousemove", onMouseMove);
                            window.addEventListener("mouseup", onMouseUp);
                          }}
                        >
                          <div className="w-2 h-10 bg-white rounded-full shadow-xl border-2 border-primary" />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Audio Section */}
            <div className="space-y-4">
              {state.audioTracks.map((track) => (
                <div key={track.id} className="h-8 relative group">
                  <div
                    className="absolute inset-y-0 rounded-lg bg-cyan-500/20 border border-cyan-500/30 overflow-hidden"
                    style={{
                      left: `${track.startTime * pixelsPerSecond}px`,
                      width: `${track.duration * pixelsPerSecond}px`,
                    }}
                  >
                    <div className="px-2 h-full flex items-center gap-2">
                      <Music size={10} className="text-cyan-400" />
                      <span className="text-[8px] font-bold text-cyan-400/60 uppercase truncate">
                        {track.name}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Overlay Section */}
            <div className="space-y-2">
              {state.overlays.map((ov) => (
                <div key={ov.id} className="h-4 relative group">
                  <div
                    className="absolute inset-y-0 rounded bg-amber-500/20 border border-amber-500/30"
                    style={{
                      left: `0px`, // Initial version: overlays cover full duration for simplicity
                      width: `${duration * pixelsPerSecond}px`,
                    }}
                  >
                    <div className="px-2 h-full flex items-center gap-2">
                      <Layers size={8} className="text-amber-500/60" />
                      <span className="text-[7px] font-black text-amber-500/40 uppercase tracking-tighter">
                        {ov.type}: {ov.text || "asset"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-primary z-[100] pointer-events-none"
            style={{ left: `${state.currentTime * pixelsPerSecond}px` }}
          >
            <div className="absolute -top-1 -left-2 w-4 h-4 bg-primary rounded-full shadow-xl flex items-center justify-center">
              <div className="w-1 h-3 bg-white/40 rounded-full" />
            </div>
          </div>

          {/* Drag Overlay Line (Optional) */}
        </div>
      </div>
    </div>
  );
}
