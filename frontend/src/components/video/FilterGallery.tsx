import React from "react";
import { useStudio } from "../../context/StudioProvider";
import { Sparkles, Moon, Sun, Camera, Filter } from "lucide-react";

const FILTERS = [
  { id: "none", name: "Original", icon: Filter, style: "none" },
  { id: "noir", name: "Noir", icon: Moon, style: "grayscale(1) contrast(1.2)" },
  {
    id: "vivid",
    name: "Vivid",
    icon: Sun,
    style: "saturate(1.8) contrast(1.1)",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    icon: Camera,
    style: "contrast(1.2) brightness(0.9) sepia(0.1)",
  },
  {
    id: "sepia",
    name: "Sepia",
    icon: Sparkles,
    style: "sepia(1) contrast(1.1)",
  },
];

export const FilterGallery: React.FC = () => {
  const { state, updateVideoSegment } = useStudio();

  // Find the segment currently at playhead
  const activeSegment =
    state.videoSegments.find(
      (seg) =>
        state.currentTime >= seg.startTime &&
        state.currentTime < seg.startTime + seg.duration,
    ) || state.videoSegments[0];

  const handleSelect = (filterId: string) => {
    if (activeSegment) {
      updateVideoSegment(activeSegment.id, { filter: filterId });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => handleSelect(f.id)}
            className={`group relative flex flex-col items-start gap-2 p-3 rounded-lg border transition-all text-left ${
              activeSegment?.filter === f.id
                ? "bg-primary/20 border-primary shadow-lg shadow-primary/10"
                : "bg-secondary/20 border-border/20 hover:border-primary/30"
            }`}
          >
            <div
              className={`w-8 h-8 rounded flex items-center justify-center transition-transform group-hover:scale-110 ${
                activeSegment?.filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <f.icon size={18} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider">
                {f.name}
              </p>
              <p className="text-[9px] text-muted-foreground line-clamp-1">
                Professional LUT preset
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
