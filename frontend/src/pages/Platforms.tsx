import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformsAPI } from '@/lib/api';
import { Youtube, Instagram, Facebook, Linkedin, Twitter, Plus, Link2, Trash2, ArrowUpRight, Signal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

interface PlatformData {
    connected: boolean;
    profileName?: string;
}

const PLATFORM_THEMES: Record<string, { gradient: string; color: string; bg: string }> = {
    youtube: {
        gradient: 'from-[#FF0000] to-[#cc0000]',
        color: 'text-white',
        bg: 'bg-[#FF0000]'
    },
    instagram: {
        gradient: 'from-[#833AB4] via-[#FD1D1D] to-[#FCB045]',
        color: 'text-white',
        bg: 'bg-gradient-to-tr from-[#833AB4] via-[#FD1D1D] to-[#FCB045]'
    },
    facebook: {
        gradient: 'from-[#1877F2] to-[#0d56b3]',
        color: 'text-white',
        bg: 'bg-[#1877F2]'
    },
    linkedin: {
        gradient: 'from-[#0A66C2] to-[#004182]',
        color: 'text-white',
        bg: 'bg-[#0A66C2]'
    },
    twitter: {
        gradient: 'from-[#1DA1F2] to-[#0c85d0]',
        color: 'text-white',
        bg: 'bg-[#1DA1F2]'
    },
};

export const Platforms = () => {
    const queryClient = useQueryClient();

    const { data: platformStats = {}, isLoading } = useQuery({
        queryKey: ['platforms'],
        queryFn: async () => {
            const response = await platformsAPI.list();
            return response.data as Record<string, PlatformData>;
        },
    });

    const disconnectMutation = useMutation({
        mutationFn: async (platformId: string) => {
            await platformsAPI.disconnect(platformId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['platforms'] });
        },
    });

    const connectedPlatforms = Object.entries(platformStats)
        .filter(([_, stats]) => stats.connected)
        .map(([id, stats]) => ({
            id,
            ...stats,
        }));

    const getIcon = (id: string) => {
        switch (id) {
            case 'youtube': return Youtube;
            case 'instagram': return Instagram;
            case 'facebook': return Facebook;
            case 'linkedin': return Linkedin;
            default: return Twitter;
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight">Connected Accounts</h1>
                    <p className="text-muted-foreground mt-2 text-lg">Manage your digital presence and automation settings.</p>
                </div>
                <Button asChild className="gap-2 h-12 px-6 rounded-xl shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-primary to-cyan-500 hover:shadow-primary/40">
                    <Link to="/platforms/connect">
                        <Plus className="w-5 h-5 animate-pulse" />
                        Connect New Platform
                    </Link>
                </Button>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-64 rounded-[2rem] bg-secondary/20 animate-pulse border border-border/30" />
                    ))}
                </div>
            ) : connectedPlatforms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <AnimatePresence mode="popLayout">
                        {connectedPlatforms.map((platform, i) => {
                            const Icon = getIcon(platform.id);
                            const theme = PLATFORM_THEMES[platform.id] || { gradient: 'from-primary to-primary/80', color: 'text-white', bg: 'bg-primary' };

                            return (
                                <motion.div
                                    key={platform.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                                    whileHover={{ y: -8, transition: { duration: 0.3, ease: "easeOut" } }}
                                    transition={{
                                        delay: i * 0.1,
                                        type: "spring",
                                        stiffness: 100,
                                        damping: 15
                                    }}
                                    className="h-full"
                                >
                                    <Card className="p-0 border-0 bg-card/40 backdrop-blur-xl overflow-hidden group h-full flex flex-col relative shadow-2xl hover:shadow-primary/10 transition-all duration-500 rounded-[2rem] ring-1 ring-white/10 hover:ring-primary/30">
                                        {/* Dynamic Glow Effect */}
                                        <div className={cn(
                                            "absolute -top-24 -right-24 w-48 h-48 blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity duration-700 rounded-full bg-gradient-to-br",
                                            theme.gradient
                                        )} />

                                        {/* Top accent line */}
                                        <div className={cn("h-1.5 w-full bg-gradient-to-r shadow-sm", theme.gradient)} />

                                        <div className="p-8 flex flex-col flex-1 relative z-10">
                                            <div className="flex items-start justify-between mb-8">
                                                <div className={cn(
                                                    "p-4 rounded-2xl shadow-2xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3",
                                                    theme.bg,
                                                    theme.color
                                                )}>
                                                    <Icon size={28} />
                                                </div>

                                                <div className="flex flex-col items-end gap-3">
                                                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-black uppercase tracking-wider border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                                        Connected
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 rounded-full bg-white/5 hover:bg-destructive/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all duration-300"
                                                        onClick={() => {
                                                            if (confirm(`Are you sure you want to disconnect your ${platform.id} account?`)) {
                                                                disconnectMutation.mutate(platform.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-3 mt-auto">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">{platform.id}</span>
                                                    <div className="flex-1 h-[1px] bg-gradient-to-r from-border/50 to-transparent" />
                                                </div>
                                                <h3 className="text-2xl font-black tracking-tight group-hover:text-primary transition-colors duration-300">
                                                    {platform.profileName || 'Active Connection'}
                                                </h3>

                                                <div className="flex items-center gap-2 pt-2">
                                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 text-primary text-[10px] font-bold uppercase tracking-wider border border-white/5 hover:bg-white/10 transition-colors">
                                                        <Signal size={12} className="animate-pulse" />
                                                        Synced Live
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between text-[11px] font-bold text-muted-foreground/60">
                                                <button className="flex items-center gap-1.5 hover:text-primary transition-colors group/link">
                                                    <ArrowUpRight size={14} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                                                    View Analytics
                                                </button>
                                                <span className="flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                                                    Active 24/7
                                                </span>
                                            </div>
                                        </div>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            ) : (
                <Card className="p-24 flex flex-col items-center justify-center text-center border-dashed border-2 bg-secondary/5 border-border/30 rounded-[3rem] relative overflow-hidden group transition-all duration-500 hover:border-primary/50 hover:bg-primary/[0.02]">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-50" />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="p-8 rounded-3xl bg-secondary/50 mb-8 shadow-2xl relative z-10 transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-6 ring-1 ring-white/10"
                    >
                        <Link2 className="w-14 h-14 text-primary opacity-80" />
                    </motion.div>

                    <h3 className="text-3xl font-black relative z-10 tracking-tight">Expand Your Reach</h3>
                    <p className="text-muted-foreground mt-4 max-w-sm text-lg relative z-10 font-medium">
                        Your unified distribution network is waiting. Link your first platform to unlock massive growth.
                    </p>

                    <Button asChild size="lg" className="mt-12 h-14 px-12 rounded-2xl shadow-2xl shadow-primary/20 relative z-10 hover:scale-105 transition-all active:scale-95 bg-gradient-to-r from-primary to-cyan-500">
                        <Link to="/platforms/connect">Connect Platform</Link>
                    </Button>
                </Card>
            )}
        </div>
    );
};
