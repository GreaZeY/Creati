import { ThemeToggle } from "../ThemeToggle";
import { HEADER_HEIGHT } from "@/lib/constants";
import { Breadcrumbs } from "./Breadcrumbs";
import { CreditIndicator } from "../composer/CreditIndicator";

export function Header() {
  return (
    <header className="sticky top-0 right-0 z-40 w-full bg-background/80 backdrop-blur-[30px] font-outfit">
      {/* Primary Header Row */}
      <div
        className={`pr-4 flex items-center justify-end gap-4 h-${HEADER_HEIGHT}`}
      >
        {/* Right: Actions */}
        <div className="flex justify-end items-center gap-4">
          <CreditIndicator />
          <ThemeToggle />
        </div>
      </div>

      {/* Secondary Row: Breadcrumbs */}
      <div className="border-t border-border/50">
        <div className="mx-auto px-4 h-10 flex items-center">
          <Breadcrumbs />
        </div>
      </div>
    </header>
  );
}
