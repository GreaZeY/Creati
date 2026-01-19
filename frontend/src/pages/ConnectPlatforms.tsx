import { useQuery, useMutation } from '@tanstack/react-query';
import { platformsAPI } from '@/lib/api';
import { Youtube, Instagram, Facebook, Linkedin, Twitter, ArrowLeft, CheckCheck, Link as LinkIcon, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PLATFORMS } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';

export const ConnectPlatforms = () => {
    const [searchParams] = useSearchParams();
    const status = searchParams.get('status');
    const platformParam = searchParams.get('platform');

    const { data: platformStats = {} as Record<string, any> } = useQuery({
        queryKey: ['platforms'],
        queryFn: async () => {
            const response = await platformsAPI.list();
            return response.data;
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
    });

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
        <div className="max-w-5xl space-y-8 pb-10">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <Button asChild variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-secondary/50 hover:bg-secondary transition-all active:scale-90">
                        <Link to="/platforms">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">Expand Your Network</h1>
                        <p className="text-muted-foreground mt-2 text-lg font-medium">Choose a platform to link your account and start distributing.</p>
                    </div>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {status === 'success' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="bg-emerald-500/10 border-2 border-emerald-500/20 p-6 rounded-3xl flex items-center gap-5 shadow-2xl shadow-emerald-500/10 backdrop-blur-md"
                    >
                        <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
                            <CheckCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-black text-xl text-emerald-500 capitalize leading-none">Connected {platformParam}!</h3>
                            <p className="text-emerald-500/80 font-bold text-sm mt-1">Your account is now ready for unified publishing.</p>
                        </div>
                        <Button asChild size="sm" className="ml-auto rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 font-bold text-white">
                            <Link to="/platforms">My Platforms</Link>
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                {Object.values(PLATFORMS).map((platform, i) => {
                    const Icon = getIcon(platform.id);
                    const isConnected = platformStats[platform.id]?.connected;
                    const isSyncing = connectMutation.isPending && connectMutation.variables === platform.id;

                    return (
                        <motion.div
                            key={platform.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05, type: "spring", stiffness: 100 }}
                        >
                            <Card className={cn(
                                "p-8 bg-card/40 backdrop-blur-xl border-border/40 hover:border-primary/50 transition-all duration-500 group relative overflow-hidden rounded-[2rem] ring-1 ring-white/5 shadow-2xl hover:shadow-primary/5",
                                isConnected && "opacity-80 border-emerald-500/30 bg-emerald-500/[0.03] ring-emerald-500/10"
                            )}>
                                {isConnected && (
                                    <div className="absolute top-0 right-0 p-3">
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
                                            <CheckCheck size={12} />
                                            Active
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-start gap-6 relative z-10">
                                    <div className={cn(
                                        "w-20 h-20 rounded-[1.5rem] flex items-center justify-center transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 shadow-2xl",
                                        isConnected ? "bg-emerald-500/10 text-emerald-500 shadow-emerald-500/10" : "bg-white/5 text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary group-hover:shadow-primary/20"
                                    )}>
                                        <Icon size={40} />
                                    </div>

                                    <div className="flex-1 space-y-2">
                                        <h3 className="text-2xl font-black tracking-tight">{platform.name}</h3>
                                        <p className="text-muted-foreground/80 font-medium mb-6 line-clamp-2 text-sm leading-relaxed">
                                            Seamlessly link your {platform.name} account to automate content distribution.
                                        </p>

                                        <div className="pt-4 flex items-center gap-4">
                                            <Button
                                                onClick={() => !isConnected && connectMutation.mutate(platform.id)}
                                                disabled={!platform.enabled || isConnected || isSyncing}
                                                variant={isConnected ? "outline" : "default"}
                                                className={cn(
                                                    "h-12 px-10 rounded-2xl font-black transition-all",
                                                    !isConnected && "bg-gradient-to-r from-primary to-cyan-500 shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 text-white"
                                                )}
                                            >
                                                {isSyncing ? 'Linking...' : isConnected ? 'Connected' : `Link ${platform.name}`}
                                            </Button>

                                            {!isConnected && platform.enabled && (
                                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 font-black uppercase tracking-[0.2em]">
                                                    <Sparkles size={14} className="text-primary animate-pulse" />
                                                    Instant
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {!platform.enabled && (
                                    <div className="absolute inset-0 bg-background/40 backdrop-blur-[16px] flex items-center justify-center p-8 text-center z-20 rounded-[2rem] transition-all duration-500 border border-white/5">
                                        <div className="space-y-4">
                                            <div className="bg-primary/20 text-primary px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest w-fit mx-auto shadow-lg shadow-primary/10 ring-1 ring-primary/20">Coming Soon</div>
                                            <p className="text-sm font-bold text-foreground/80 leading-relaxed max-w-[200px]">
                                                Integration for {platform.name} is arriving in a future update.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </motion.div>
                    );
                })}
            </div>

            <Card className="p-8 border-primary/20 bg-primary/[0.02] mt-10 rounded-3xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-primary/10 transition-colors" />
                <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                    <div className="p-5 rounded-2xl bg-primary/10 text-primary">
                        <LinkIcon size={32} />
                    </div>
                    <div className="text-center md:text-left flex-1 space-y-2">
                        <h4 className="text-xl font-bold">Why link multiple accounts?</h4>
                        <p className="text-muted-foreground max-w-xl">
                            Our intelligent distribution engine automatically reformats and optimizes your video for each platform's specific audiences and algorithms.
                        </p>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-center">
                            <div className="text-2xl font-black text-primary">2.4x</div>
                            <div className="text-[10px] font-bold uppercase text-muted-foreground">Reach</div>
                        </div>
                        <div className="w-[1px] h-10 bg-border/50" />
                        <div className="text-center">
                            <div className="text-2xl font-black text-primary">0</div>
                            <div className="text-[10px] font-bold uppercase text-muted-foreground">Extra Work</div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
