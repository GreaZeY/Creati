import { motion } from "framer-motion";
import type { OverlayItem } from "./VideoEditorModal";

interface OverlayElementProps {
  overlay: OverlayItem;
  isSelected: boolean;
  containerSize: { width: number; height: number };
  pctToPx: (pct: number, dim: number) => number;
  onSelect: (id: string) => void;
}

const ANIMATION_VARIANTS = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  "slide-up": {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  "slide-down": {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },
  "zoom-in": {
    initial: { opacity: 0, scale: 0.5 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.5 },
  },
  "zoom-out": {
    initial: { opacity: 1, scale: 1 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.5 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
};

export function OverlayElement({
  overlay: ov,
  isSelected,
  containerSize,
  pctToPx,
  onSelect,
}: OverlayElementProps) {
  const hasExplicitSize = ov.type === "sticker" || ov.type === "image";
  const animationIn = ov.animationIn || "none";
  const animationOut = ov.animationOut || "none";
  const duration = ov.animationDuration || 0.5;

  const variants = {
    initial: ANIMATION_VARIANTS[animationIn]?.initial || {},
    animate: ANIMATION_VARIANTS[animationIn]?.animate || {},
    exit: ANIMATION_VARIANTS[animationOut]?.exit || {},
  };

  return (
    <motion.div
      id={`overlay-${ov.id}`}
      className={`absolute cursor-move ${isSelected ? "outline outline-2 outline-primary outline-offset-2" : ""}`}
      style={{
        left: `${pctToPx(ov.x, containerSize.width)}px`,
        top: `${pctToPx(ov.y, containerSize.height)}px`,
        transform: `rotate(${ov.rotation}deg)`,
        userSelect: "none",
        ...(hasExplicitSize
          ? {
              width: `${Math.max(40, (ov.width / 100) * containerSize.width)}px`,
              height: `${Math.max(40, (ov.height / 100) * containerSize.height)}px`,
              containerType: "inline-size" as any,
            }
          : {}),
      }}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(ov.id);
      }}
    >
      {ov.type === "text" && (
        <div
          className="px-3 py-1.5 whitespace-nowrap font-bold drop-shadow-lg"
          style={{
            fontSize: `${ov.fontSize || 24}px`,
            color: ov.fontColor,
            backgroundColor: ov.bgColor,
            fontFamily: ov.fontFamily,
            borderRadius: ov.bgColor !== "transparent" ? "6px" : undefined,
            textShadow:
              ov.bgColor === "transparent"
                ? "0 2px 8px rgba(0,0,0,0.8)"
                : undefined,
          }}
        >
          {ov.text || "Text"}
        </div>
      )}

      {ov.type === "sticker" && (
        <div
          className="w-full h-full flex items-center justify-center select-none"
          style={{ fontSize: "70cqi", lineHeight: 1 }}
        >
          {ov.src}
        </div>
      )}

      {ov.type === "image" && ov.src && (
        <img
          src={ov.src}
          alt="overlay"
          className="w-full h-full rounded-md pointer-events-none"
          style={{ objectFit: "contain" }}
          draggable={false}
        />
      )}
    </motion.div>
  );
}
