import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LensedCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function LensedCard({ children, className, onClick }: LensedCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden bg-white/80 dark:bg-card/40 border-0 ring-1 ring-border shadow-glass backdrop-blur-xl transition-all duration-500 rounded-[32px]",
        className,
      )}
    >
      {/* Dynamic Cinematic Lens Glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-700 group-hover/card:opacity-100 mix-blend-screen"
        style={{
          background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(185, 70, 255, 0.08) 0%, rgba(0, 240, 255, 0.02) 25%, transparent 60%)`,
        }}
      />

      {/* Atmospheric Inner Glimmer */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none z-0" />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
