import { ThemeToggle } from "../ThemeToggle";
import { HEADER_HEIGHT } from "@/lib/constants";
import { Breadcrumbs } from "./Breadcrumbs";

export function Header() {
  return (
    <header
      className={`sticky top-0 right-0 z-40 w-full bg-background/80 backdrop-blur-[30px] font-outfit h-${HEADER_HEIGHT}`}
    >
      {/* Primary Header Row */}
      <div className="max-w-7xl pr-8 flex items-center justify-end gap-4 h-full">
        {/* Right: Actions */}
        <div className="w-48 flex justify-end items-center gap-4">
          <ThemeToggle />
        </div>
      </div>

      {/* Secondary Row: Breadcrumbs */}
      <div className="border-t border-border/50">
        <div className="max-w-7xl mx-auto px-8 h-10 flex items-center">
          <Breadcrumbs />
        </div>
      </div>
    </header>
  );
}
