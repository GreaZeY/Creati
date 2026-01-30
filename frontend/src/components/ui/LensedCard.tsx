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
      className={cn("glass-card lens-effect rounded-3xl p-6 group", className)}
      style={{
        // @ts-ignore
        "--mouse-x": `${mousePos.x}%`,
        "--mouse-y": `${mousePos.y}%`,
      }}
    >
      {/* Dynamic Glow Accent */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, hsl(var(--primary) / 0.2) 0%, transparent 45%)`,
        }}
      />

      <div className="relative z-10 font-outfit w-full h-full flex flex-col">
        {children}
      </div>
    </div>
  );
}
