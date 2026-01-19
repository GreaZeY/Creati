import { useQuery } from '@tanstack/react-query';
import { videosAPI } from '@/lib/api';
import { VideoCard, VideoCardSkeleton } from '@/components/dashboard/VideoCard';
import { PlusCircle, UploadCloud, Link2, LayoutDashboard, ArrowRight, Zap, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { motion } from 'framer-motion';

export const Dashboard = () => {
    const navigate = useNavigate();

    const { data, isLoading } = useQuery({
        queryKey: ['videos'],
        queryFn: async () => {
            const resp = await videosAPI.list();
            return resp.data.data;
        },
        refetchInterval: (query) => {
            const videos = query.state.data as any[];
            if (videos?.some(v => v.jobStatus === 'processing' || v.jobStatus === 'pending')) {
                return 5000;
            }
            return false;
        }
    });

    const videos = data || [];

    return (
        <div className="space-y-10">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
                <div>
                    <motion.h2
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-5xl font-black tracking-tighter bg-gradient-to-r from-foreground via-foreground to-foreground/40 bg-clip-text text-transparent"
                    >
                        Welcome Back
                    </motion.h2>
                    <p className="text-muted-foreground mt-3 text-xl font-medium">Your unified distribution workspace is live.</p>
                </div>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                >
                    <Button asChild size="lg" className="shadow-2xl shadow-primary/40 rounded-[1.5rem] h-16 px-10 group relative overflow-hidden bg-gradient-to-r from-primary to-cyan-500 border-0 hover:scale-105 active:scale-95 transition-all duration-300">
                        <Link to="/upload" className="flex items-center gap-4 relative z-10">
                            <PlusCircle className="w-6 h-6 transition-transform group-hover:rotate-90 duration-500 text-white" />
                            <span className="font-black text-lg text-white">New Distribution</span>
                            {/* Animated Glow Effect - Moved inside Link */}
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
                        </Link>
                    </Button>
                </motion.div>
            </header>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {/* Platforms Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="p-8 border-0 bg-card/40 backdrop-blur-xl hover:bg-card/50 transition-all duration-500 group relative overflow-hidden rounded-[2.5rem] ring-1 ring-white/10 hover:ring-primary/40 shadow-2xl h-full flex flex-col justify-between">
                        <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/10 rounded-full blur-[80px] group-hover:bg-primary/20 transition-all duration-700" />

                        <div className="relative z-10 flex flex-col gap-6">
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-primary/10 text-primary rounded-2xl shadow-inner ring-1 ring-primary/20">
                                    <Link2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-black text-xl tracking-tight">Platforms</h3>
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Network Status</p>
                                </div>
                            </div>
                            <p className="text-muted-foreground leading-relaxed font-medium">
                                Connect YouTube, TikTok, and Instagram to automate your reach.
                            </p>
                        </div>

                        <div className="relative z-10 pt-6">
                            <Button
                                variant="secondary"
                                className="w-full h-14 rounded-2xl font-black group bg-secondary/50 hover:bg-secondary border-0 transition-all"
                                onClick={() => navigate('/platforms')}
                            >
                                Manage Network
                                <ArrowRight className="w-5 h-5 ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                            </Button>
                        </div>
                    </Card>
                </motion.div>

                {/* Performance Preview */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card className="p-8 border-0 bg-card/40 backdrop-blur-xl hover:bg-card/50 transition-all duration-500 group relative overflow-hidden rounded-[2.5rem] ring-1 ring-white/10 hover:ring-amber-500/40 shadow-2xl h-full flex flex-col justify-between">
                        <div className="absolute -top-20 -right-20 w-48 h-48 bg-amber-500/10 rounded-full blur-[80px] transition-all duration-700" />

                        <div className="relative z-10 flex flex-col gap-6">
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-amber-500/10 text-amber-500 rounded-2xl shadow-inner ring-1 ring-amber-500/20">
                                    <TrendingUp className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-black text-xl tracking-tight">Insights</h3>
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Performance</p>
                                </div>
                            </div>

                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-foreground">2.4k</span>
                                <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1 bg-emerald-400/10 px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm ring-1 ring-emerald-400/20">
                                    <Zap size={12} className="fill-emerald-400" /> +12%
                                </span>
                            </div>
                        </div>

                        <div className="relative z-10 pt-6">
                            <Button
                                variant="ghost"
                                className="w-full h-14 rounded-2xl font-black hover:bg-secondary/50 transition-all"
                                onClick={() => navigate('/analytics')}
                            >
                                View Detailed Stats
                            </Button>
                        </div>
                    </Card>
                </motion.div>

                {/* Upload Status Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card className="p-8 border-0 bg-card/40 backdrop-blur-xl hover:bg-card/50 transition-all duration-500 group relative overflow-hidden rounded-[2.5rem] ring-1 ring-white/10 hover:ring-foreground/20 shadow-2xl h-full flex flex-col justify-between">
                        <div className="absolute -top-20 -right-20 w-48 h-48 bg-foreground/5 rounded-full blur-[80px]" />

                        <div className="relative z-10 flex flex-col gap-6">
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-foreground/10 text-foreground rounded-2xl shadow-inner ring-1 ring-foreground/20">
                                    <LayoutDashboard className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-black text-xl tracking-tight">Archive</h3>
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Library</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-muted-foreground font-bold text-sm uppercase tracking-tighter">Total Distributed</span>
                                    <span className="text-3xl font-black">{videos.length}</span>
                                </div>
                                <div className="w-full h-3 bg-secondary/50 rounded-full overflow-hidden p-0.5">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: '65%' }}
                                        className="h-full bg-primary rounded-full shadow-[0_0_12px_rgba(106,227,180,0.5)]"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                </motion.div>
            </div>

            <div className="pt-12">
                <div className="flex items-center justify-between mb-10">
                    <div className="space-y-1">
                        <h3 className="text-3xl font-black tracking-tight">Recent Distributions</h3>
                        <p className="text-sm text-muted-foreground font-medium uppercase tracking-[0.2em] opacity-60">Activity Feed</p>
                    </div>
                    {videos.length > 3 && (
                        <Button variant="ghost" className="font-black text-primary hover:bg-primary/5 rounded-xl transition-all h-10 px-5 group">
                            View All Activities
                            <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                        </Button>
                    )}
                </div>

                {isLoading ? (
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map(i => (
                            <VideoCardSkeleton key={i} />
                        ))}
                    </div>
                ) : videos.length > 0 ? (
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {videos.map((video: any) => (
                            <VideoCard key={video.id} video={video} />
                        ))}
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <Card className="p-24 border-2 border-dashed border-primary/20 flex flex-col items-center text-center bg-card/20 backdrop-blur-xl rounded-[3rem] shadow-2xl relative overflow-hidden group">
                            {/* Decorative background glow */}
                            <div className="absolute inset-0 bg-primary/[0.02] group-hover:bg-primary/[0.04] transition-colors duration-700" />
                            <div className="absolute -top-32 -left-32 w-64 h-64 bg-primary/5 rounded-full blur-[100px]" />

                            <div className="relative z-10">
                                <div className="w-24 h-24 bg-gradient-to-br from-secondary/50 to-secondary rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl ring-1 ring-white/10 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                                    <UploadCloud className="w-12 h-12 text-primary" />
                                </div>
                                <h3 className="text-3xl font-black mb-4 tracking-tight">Ready to publish?</h3>
                                <p className="text-muted-foreground mb-12 max-w-sm text-lg font-medium leading-relaxed">
                                    Your library is currently empty. Upload your first video and see it spread across your network.
                                </p>
                                <Button size="lg" className="rounded-2xl h-16 px-12 shadow-2xl shadow-primary/30 font-black text-lg bg-gradient-to-r from-primary to-cyan-500 hover:scale-105 active:scale-95 transition-all" onClick={() => navigate('/upload')}>
                                    Start Your First Upload
                                </Button>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </div>
        </div>
    );
};
