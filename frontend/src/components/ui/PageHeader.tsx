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
        "flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4",
        className,
      )}
    >
      <div>
        {/* <h1 className="text-lg font-bold tracking-tight text-foreground">
          {title}
        </h1> */}
        {description && (
          <p className="text-muted-foreground mt-1 text-lg">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
