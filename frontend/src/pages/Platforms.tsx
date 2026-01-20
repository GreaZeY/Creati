import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformsAPI } from '@/lib/api';
import { Plus, Link2, MoreVertical, ShieldOff, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/Skeleton';
import { PlatformLogo } from '@/components/platforms/PlatformLogo';
import { DropdownMenu, DropdownItem } from '@/components/ui/DropdownMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useState } from 'react';
import { toast } from '@/lib/events';

interface PlatformData {
    id: string;
    name: string;
    platform: string;
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

    const { data: platformStats = [], isLoading } = useQuery({
        queryKey: ['platforms'],
        queryFn: async () => {
            const response = await platformsAPI.list();
            return response.data as PlatformData[];
        },
    });

    const connectMutation = useMutation({
        mutationFn: async (platformId: string) => {
            const { data } = await platformsAPI.connect(platformId);
            const { authUrl } = data.data;
            if (authUrl) {
                window.location.assign(authUrl);
            }
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to initiate reconnection.");
        }
    });

    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        type: 'disconnect' | 'remove' | null;
        platformId: string | null;
        platformName: string | null;
    }>({
        isOpen: false,
        type: null,
        platformId: null,
        platformName: null
    });

    const disconnectMutation = useMutation({
        mutationFn: async (platformId: string) => {
            await platformsAPI.disconnect(platformId);
        },
        onSuccess: (_, platformId) => {
            queryClient.invalidateQueries({ queryKey: ['platforms'] });
            toast.success(`${platformId} account disconnected.`);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to disconnect account.");
        }
    });

    const removeMutation = useMutation({
        mutationFn: async (platformId: string) => {
            await platformsAPI.remove(platformId);
        },
        onSuccess: (_, platformId) => {
            queryClient.invalidateQueries({ queryKey: ['platforms'] });
            toast.success(`${platformId} account removed.`);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to remove platform.");
        }
    });

    const handleConfirm = () => {
        if (!confirmState.platformId || !confirmState.type) return;

        if (confirmState.type === 'disconnect') {
            disconnectMutation.mutate(confirmState.platformId);
        } else {
            removeMutation.mutate(confirmState.platformId);
        }
        setConfirmState(prev => ({ ...prev, isOpen: false }));
    };

    const handleReconnect = (platformId: string) => {
        connectMutation.mutate(platformId);
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight">Distribution Network</h1>
                    <p className="text-muted-foreground mt-2 text-lg">Manage your connected accounts and automation settings.</p>
                </div>
                <Button asChild className="gap-2 h-12 px-6 rounded-xl shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-primary to-cyan-500 hover:shadow-primary/40">
                    <Link to="/platforms/connect">
                        <Plus className="w-5 h-5" />
                        Connect New Platform
                    </Link>
                </Button>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[1, 2, 3].map(i => (
                        <PlatformSkeleton key={i} />
                    ))}
                </div>
            ) : platformStats.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <AnimatePresence mode="popLayout">
                        {platformStats.map((platform: PlatformData, i: number) => {
                            const theme = PLATFORM_THEMES[platform.id] || { gradient: 'from-primary to-primary/80', color: 'text-white', bg: 'bg-primary' };

                            return (
                                <motion.div
                                    key={platform.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.98, x: -20 }}
                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, x: 20, transition: { duration: 0.2 } }}
                                    transition={{
                                        delay: i * 0.05,
                                        type: "spring",
                                        stiffness: 120,
                                        damping: 20
                                    }}
                                    className="w-full"
                                >
                                    <Card className={cn(
                                        "p-0 border-0 bg-card/40 backdrop-blur-xl group relative flex flex-row items-stretch transition-all duration-300 rounded-2xl ring-1 ring-white/10 hover:ring-primary/30",
                                        !platform.connected && "grayscale-[0.5] opacity-75 hover:grayscale-0 hover:opacity-100"
                                    )}>
                                        {/* Accent side line */}
                                        <div className={cn("w-1 shrink-0 bg-gradient-to-b", theme.gradient)} />

                                        {/* Kebab menu at top-right */}
                                        <div className="absolute top-3 right-3 z-10">
                                            <DropdownMenu
                                                trigger={
                                                    <button className="p-2 rounded-lg text-muted-foreground/60 hover:text-white hover:bg-white/5 transition-colors">
                                                        <MoreVertical size={18} />
                                                    </button>
                                                }
                                            >
                                                {platform.connected && (
                                                    <DropdownItem
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setConfirmState({
                                                                isOpen: true,
                                                                type: 'disconnect',
                                                                platformId: platform.id,
                                                                platformName: platform.name
                                                            });
                                                        }}
                                                    >
                                                        <ShieldOff size={16} />
                                                        Disconnect
                                                    </DropdownItem>
                                                )}
                                                <DropdownItem
                                                    variant="danger"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmState({
                                                            isOpen: true,
                                                            type: 'remove',
                                                            platformId: platform.id,
                                                            platformName: platform.name
                                                        });
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                    Remove
                                                </DropdownItem>
                                            </DropdownMenu>
                                        </div>

                                        <div className="flex flex-row items-center gap-5 p-5 pr-12 w-full">
                                            <div className={cn(
                                                "w-14 h-14 rounded-xl shadow-lg transition-transform duration-300 group-hover:scale-105 flex items-center justify-center shrink-0",
                                                theme.bg,
                                                theme.color
                                            )}>
                                                <PlatformLogo platform={platform.id} size={28} />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-xl font-bold tracking-tight truncate">
                                                        {platform.profileName || platform.name}
                                                    </h3>
                                                    {platform.connected ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold uppercase tracking-wide">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-[10px] font-semibold uppercase tracking-wide">
                                                            <AlertTriangle size={10} />
                                                            Inactive
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground/60 mt-1 uppercase tracking-wider">
                                                    {platform.id}
                                                </p>
                                            </div>

                                            {!platform.connected && (
                                                <Button
                                                    onClick={() => handleReconnect(platform.id)}
                                                    isLoading={connectMutation.isPending && connectMutation.variables === platform.id}
                                                    size="sm"
                                                    variant={platform.profileName ? "ghost" : "default"}
                                                    className={cn(
                                                        "rounded-lg px-4 h-8 text-xs font-medium transition-all duration-300",
                                                        platform.profileName
                                                            ? "!bg-transparent text-emerald-500 border border-emerald-500/60 hover:border-emerald-500 hover:bg-emerald-500/10"
                                                            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/30"
                                                    )}
                                                >
                                                    {platform.profileName ? 'Reconnect' : 'Connect'}
                                                </Button>
                                            )}
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

            <ConfirmDialog
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={handleConfirm}
                title={confirmState.type === 'disconnect' ? 'Disconnect Account?' : 'Remove Platform?'}
                description={
                    confirmState.type === 'disconnect'
                        ? `This will pause all automated posts and syncing for ${confirmState.platformName}. You can reconnect anytime.`
                        : `This will completely remove ${confirmState.platformName} and all associated access tokens from our system.`
                }
                confirmText={confirmState.type === 'disconnect' ? 'Disconnect' : 'Remove Permanently'}
                variant={confirmState.type === 'disconnect' ? 'warning' : 'danger'}
                isLoading={disconnectMutation.isPending || removeMutation.isPending}
            />
        </div >
    );
};

const PlatformSkeleton = () => {
    return (
        <Card className="p-0 border-0 bg-card/40 backdrop-blur-xl overflow-hidden h-[160px] flex flex-row items-center relative shadow-2xl rounded-[2rem] ring-1 ring-white/10">
            <div className="w-1.5 self-stretch bg-secondary/50" />
            <div className="flex flex-row items-center gap-8 p-8 w-full">
                <Skeleton className="w-20 h-20 rounded-[1.5rem] shrink-0" />
                <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-48 h-8 rounded-lg" />
                        <Skeleton className="w-20 h-6 rounded-full" />
                    </div>
                    <div className="flex items-center gap-4">
                        <Skeleton className="w-24 h-4 rounded-md" />
                        <Skeleton className="w-32 h-4 rounded-md" />
                    </div>
                </div>
                <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
            </div>
        </Card>
    );
};
