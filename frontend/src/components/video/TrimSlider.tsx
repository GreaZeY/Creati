import { useRef, useCallback } from "react";
import { Scissors } from "lucide-react";

interface TrimSliderProps {
  duration: number;
  start: number;
  end: number;
  currentTime: number;
  onChange: (start: number, end: number) => void;
}

export function TrimSlider({
  duration,
  start,
  end,
  currentTime,
  onChange,
}: TrimSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const getTimeFromPosition = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      return ratio * duration;
    },
    [duration],
  );

  const handlePointerDown = useCallback(
    (handle: "start" | "end") => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const time = getTimeFromPosition(ev.clientX);
        if (handle === "start") {
          const clamped = Math.max(0, Math.min(time, end - 0.5));
          onChange(clamped, end);
        } else {
          const clamped = Math.min(duration, Math.max(time, start + 0.5));
          onChange(start, clamped);
        }
      };

      const onUp = () => {
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);
      };

      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
    },
    [duration, start, end, onChange, getTimeFromPosition],
  );

  const startPct = duration > 0 ? (start / duration) * 100 : 0;
  const endPct = duration > 0 ? (end / duration) * 100 : 100;
  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
          <Scissors size={14} /> Trim
        </div>
        <div className="text-xs font-mono text-muted-foreground">
          {formatTime(start)} - {formatTime(end)}
          <span className="ml-2 opacity-60">({formatTime(end - start)})</span>
        </div>
      </div>

      {/* Track */}
      <div ref={trackRef} className="relative h-10 select-none touch-none">
        {/* Background track */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2 bg-secondary rounded-full" />

        {/* Inactive regions (dimmed) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-2 bg-muted-foreground/10 rounded-l-full"
          style={{ left: 0, width: `${startPct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-2 bg-muted-foreground/10 rounded-r-full"
          style={{ left: `${endPct}%`, width: `${100 - endPct}%` }}
        />

        {/* Active region */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-2 bg-primary rounded-sm"
          style={{
            left: `${startPct}%`,
            width: `${endPct - startPct}%`,
          }}
        />

        {/* Playhead */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-white rounded-full pointer-events-none z-20"
          style={{ left: `${playheadPct}%` }}
        />

        {/* Start handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-30 cursor-ew-resize"
          style={{ left: `${startPct}%` }}
          onPointerDown={handlePointerDown("start")}
        >
          <div className="w-4 h-8 rounded-md bg-white border-2 border-primary shadow-lg flex items-center justify-center hover:scale-110 transition-transform">
            <div className="w-0.5 h-3 bg-primary/60 rounded-full" />
          </div>
        </div>

        {/* End handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-30 cursor-ew-resize"
          style={{ left: `${endPct}%` }}
          onPointerDown={handlePointerDown("end")}
        >
          <div className="w-4 h-8 rounded-md bg-white border-2 border-primary shadow-lg flex items-center justify-center hover:scale-110 transition-transform">
            <div className="w-0.5 h-3 bg-primary/60 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
