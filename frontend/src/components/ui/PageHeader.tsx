import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 mt-4",
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="text-4xl font-black font-display tracking-tighter text-foreground dark:text-white uppercase italic">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground/40 text-xs font-bold uppercase tracking-[0.2em]">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
