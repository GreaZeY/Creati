import React from "react";
import { useStudio } from "../../context/StudioProvider";
import type { TransitionItem } from "../../context/StudioProvider";
import { Wand2, Zap, Layers, Maximize, Move } from "lucide-react";

const TRANSITIONS: {
  id: TransitionItem["type"];
  name: string;
  icon: any;
  description: string;
}[] = [
  {
    id: "fade",
    name: "Cross Dissolve",
    icon: Wand2,
    description: "Smoothly blend between clips",
  },
  {
    id: "wipe",
    name: "Wipe",
    icon: Move,
    description: "Slide one clip over another",
  },
  {
    id: "zoom",
    name: "Zoom",
    icon: Maximize,
    description: "Cinematic zoom transition",
  },
  {
    id: "glitch",
    name: "Glitch",
    icon: Zap,
    description: "Digital distortion effect",
  },
  {
    id: "slide",
    name: "Slide",
    icon: Layers,
    description: "Push current clip out",
  },
];

export const TransitionGallery: React.FC = () => {
  const { addTransition } = useStudio();

  const handleSelect = (transitionId: TransitionItem["type"]) => {
    addTransition({
      type: transitionId,
      duration: 1.0,
      offset: 0,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {TRANSITIONS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleSelect(t.id)}
            className="group relative flex flex-col items-start gap-2 p-3 rounded-lg bg-secondary/20 hover:bg-primary/10 border border-border/20 hover:border-primary/30 transition-all text-left"
          >
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <t.icon size={18} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider">
                {t.name}
              </p>
              <p className="text-[9px] text-muted-foreground line-clamp-1">
                {t.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
