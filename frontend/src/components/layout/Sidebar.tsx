import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    UploadCloud,
    BarChart2,
    Settings,
    Link2,
    LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const NAV_ITEMS = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Upload', icon: UploadCloud, href: '/upload' },
    { label: 'Analytics', icon: BarChart2, href: '/analytics' },
    { label: 'Platforms', icon: Link2, href: '/connect' },
    { label: 'Settings', icon: Settings, href: '/settings' },
];

export function Sidebar() {
    const { pathname } = useLocation();
    const { logout } = useAuth();

    return (
        <div className="fixed left-0 top-0 h-full w-60 bg-background z-50 flex flex-col shadow-[inset_-1px_0_0_rgba(255,255,255,0.05)]">
            {/* Brand */}
            <div className="h-20 flex items-center px-6">
                <h1 className="text-xl font-bold tracking-tight text-foreground">Creati<span className="text-primary">.</span></h1>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 space-y-1 py-4">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            className="relative group block"
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeNav"
                                    className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-r-full"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.2 }}
                                />
                            )}

                            <div
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-primary/5 text-primary"
                                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                                )}
                            >
                                <Icon
                                    size={20}
                                    className={cn(
                                        "transition-transform duration-200 group-hover:-translate-y-0.5",
                                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                    )}
                                />
                                {item.label}
                            </div>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / Logout */}
            <div className="p-4 border-t border-border/40">
                <button
                    onClick={logout}
                    className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                    <LogOut size={20} />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
