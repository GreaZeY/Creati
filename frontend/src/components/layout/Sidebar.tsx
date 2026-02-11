import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  UploadCloud,
  BarChart2,
  Settings,
  Link2,
  Zap,
  LogOut,
  Crown,
  List,
  MessageSquare,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Dispatch", icon: UploadCloud, href: "/upload" },
  { label: "Automations", icon: Zap, href: "/automations" },
  { label: "Post", icon: MessageSquare, href: "/create/post" },
  { label: "Push Video", icon: Video, href: "/push" },
  { label: "Queue", icon: List, href: "/queued" },
  { label: "Analytics", icon: BarChart2, href: "/analytics" },
  { label: "Platforms", icon: Link2, href: "/platforms" },
  { label: "Upgrade", icon: Crown, href: "/pricing" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const { logout } = useAuth();

  return (
    <div className="fixed left-0 top-0 h-full w-80 bg-white/60 dark:bg-charcoal/30 backdrop-blur-2xl border-r border-white/50 dark:border-glass-border z-50 flex flex-col font-sans shadow-sm">
      {/* Brand */}
      <div
        className={`h-24 flex items-center px-8 border-b border-glass-border shrink-0 box-border`}
      >
        <div className="flex items-center gap-3 text-foreground dark:text-white font-black text-3xl tracking-tighter font-display italic">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-neon-purple to-neon-pink flex items-center justify-center shadow-glow-purple">
            <Zap size={20} className="text-white fill-white" />
          </div>
          <span className="text-foreground dark:text-white">Creati</span>
        </div>
      </div>

      {/* Nav */}
      <div className="h-full flex flex-col">
        <nav className="flex-1 px-6 space-y-3 py-8 overflow-y-auto">
          <div className="mb-6 px-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">
              Main Menu
            </p>
            {NAV_ITEMS.slice(0, 3).map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className="relative group block mb-2"
                >
                  <div
                    className={cn(
                      "flex items-center px-6 py-4 rounded-2xl text-sm font-bold transition-all duration-300 gap-4",
                      isActive
                        ? "bg-neon-purple/10 text-neon-purple border border-neon-purple/20 shadow-glow-purple"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white border border-transparent hover:border-white hover:shadow-sm",
                    )}
                  >
                    <Icon
                      size={18}
                      className={cn(
                        isActive
                          ? "text-neon-purple"
                          : "group-hover:text-neon-purple",
                      )}
                    />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="px-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">
              Creation Hub
            </p>
            {NAV_ITEMS.slice(3, NAV_ITEMS.length - 1).map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className="relative group block mb-2"
                >
                  <div
                    className={cn(
                      "flex items-center px-6 py-4 rounded-2xl text-sm font-bold transition-all duration-300 gap-4",
                      isActive
                        ? "bg-neon-blue/10 text-neon-blue border border-neon-blue/20 shadow-glow-blue"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white border border-transparent hover:border-white hover:shadow-sm",
                    )}
                  >
                    <Icon
                      size={18}
                      className={cn(
                        isActive
                          ? "text-neon-blue"
                          : "group-hover:text-neon-blue",
                      )}
                    />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer / Account */}
        <div className="p-6">
          <div className="glass-panel p-4 rounded-3xl flex items-center gap-3 cursor-pointer transition-all duration-300 border border-white/50 dark:border-glass-border group relative">
            <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-neon-pink ring-offset-2 ring-offset-white dark:ring-offset-midnight shadow-glow-pink">
              <img
                alt="Profile"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDrRDGLkZjh7VvZ0Kda0Meni_8Dh70VBttDYZjftO8Qn4AqXupdWf6qRN3zaekU2dy2PNZqOyLauKHzdgPFazMxrKgh1yr8paZjFLqgiVAWr4LB7K4yb_Taxbd-w3nfLjH9lSb-Gz6L8T4jNpcwjBizTXGOeZ4XfQh-OitmSAEGqFHmvMWwKUeYasg-mppO1f9vtRSkCifnx8JJXA0sqzPjamVx8pedeL1QWY1R2ikl_ZY4CQLWQaP7FS6rOi47Mo76Nhe__cpGAa4"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                Sarah J.
              </p>
              <p className="text-xs text-neon-pink font-bold truncate">
                @sarah_creates
              </p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-destructive transition-colors shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
