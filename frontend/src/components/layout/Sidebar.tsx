import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  UploadCloud,
  BarChart2,
  Settings,
  Link2,
  Zap,
  LogOut,
  Crown,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { label: "COMMAND", icon: LayoutDashboard, href: "/dashboard" },
  { label: "DISPATCH", icon: UploadCloud, href: "/upload" },
  { label: "WORKFLOWS", icon: Zap, href: "/automation" },
  { label: "QUICK BLAST", icon: Rocket, href: "/blast" },
  { label: "INTELLIGENCE", icon: BarChart2, href: "/analytics" },
  { label: "NODES", icon: Link2, href: "/platforms" },
  { label: "ASCEND", icon: Crown, href: "/pricing" },
  { label: "CONFIG", icon: Settings, href: "/settings" },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const { logout } = useAuth();

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-card/20 backdrop-blur-[30px] z-50 flex flex-col border-r border-border font-outfit">
      {/* Brand */}
      <div className="h-24 flex items-center px-8">
        <h1 className="text-3xl font-black tracking-tighter italic uppercase text-foreground">
          Creati<span className="text-primary blur-[0.5px]">.</span>
        </h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 space-y-2 py-6">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href + "/"));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className="relative group block"
            >
              <div
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-2xl text-[11px] font-black tracking-[0.2em] transition-all duration-300 uppercase",
                  isActive
                    ? "bg-primary/10 text-primary shadow-[inset_0_0_15px_rgba(var(--primary),0.05)] ring-1 ring-primary/20"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-accent/10",
                )}
              >
                <Icon
                  size={18}
                  className={cn(
                    "transition-all duration-300",
                    isActive
                      ? "text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                      : "opacity-40 group-hover:opacity-100",
                  )}
                />
                {item.label}
              </div>

              {isActive && (
                <motion.div
                  layoutId="activeNavIndicator"
                  className="absolute left-[-16px] top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full shadow-[0_0_15px_rgba(var(--primary),0.8)]"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Account */}
      <div className="p-6 border-t border-border">
        <button
          onClick={logout}
          className="flex items-center gap-4 px-4 py-3 w-full rounded-2xl text-[11px] font-black tracking-[0.2em] text-muted-foreground/60 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300 uppercase"
        >
          <LogOut size={18} />
          Term Session
        </button>
      </div>
    </div>
  );
}
