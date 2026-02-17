import { ThemeToggle } from "../ThemeToggle";
import { Breadcrumbs } from "./Breadcrumbs";
import { CreditIndicator } from "../composer/CreditIndicator";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { User } from "lucide-react";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="h-[3.5rem] flex items-center justify-between px-8 z-10 sticky top-0 bg-transparent font-sans">
      <div className="flex items-center gap-6">
        <WorkspaceSwitcher />
        <div className="w-px h-6 bg-slate-200 dark:bg-white/10 hidden md:block" />
        <Breadcrumbs />
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden sm:flex items-center gap-4">
          <CreditIndicator />
          <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />
          <ThemeToggle />
        </div>

        <div className="relative w-8 aspect-square rounded-full overflow-hidden ring-2 ring-neon-purple ring-offset-2 ring-offset-white dark:ring-offset-midnight shadow-glow-purple group cursor-pointer hover:scale-105 transition-all bg-secondary/20 flex items-center justify-center">
          {user?.picture_url ? (
            <img
              src={user.picture_url}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <User size={14} className="text-slate-400" />
          )}
        </div>
      </div>
    </header>
  );
}
