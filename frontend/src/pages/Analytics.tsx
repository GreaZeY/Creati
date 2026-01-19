import { Card } from '@/components/ui/Card';
import { BarChart2, TrendingUp, Users, Play, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatItem {
    label: string;
    value: string;
    icon: any;
    change: string;
    trend: 'up' | 'down';
}

export const Analytics = () => {
    const stats: StatItem[] = [
        { label: 'Total Views', value: '128.4K', icon: Play, change: '+12%', trend: 'up' },
        { label: 'Avg. Retention', value: '64%', icon: Clock, change: '+5%', trend: 'up' },
        { label: 'Total Engagement', value: '4.2K', icon: Users, change: '-2%', trend: 'down' },
    ];

    return (
        <div className="space-y-8">
            <header className="space-y-3 pb-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 ring-1 ring-primary/20 shadow-inner">
                        <BarChart2 className="w-7 h-7 text-primary" />
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">Channel Analytics</h2>
                </div>
                <p className="text-muted-foreground text-lg font-medium">Monitor your performance across all connected platforms.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {stats.map((stat, i) => {
                    const isUp = stat.trend === 'up';

                    return (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
                        >
                            <Card className="p-8 border-0 bg-card/40 backdrop-blur-xl hover:bg-card/50 transition-all duration-500 group relative overflow-hidden rounded-[2.5rem] ring-1 ring-white/10 hover:ring-primary/30 shadow-2xl h-full flex flex-col justify-between">
                                {/* Tailored Glow Background */}
                                <div className={cn(
                                    "absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-10 group-hover:opacity-20 transition-all duration-700 bg-gradient-to-br",
                                    isUp ? "from-emerald-500 to-cyan-500" : "from-amber-500 to-orange-500"
                                )} />

                                <div className="relative z-10 flex items-center justify-between">
                                    <div className={cn(
                                        "p-4 rounded-2xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-inner ring-1",
                                        isUp ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20" : "bg-amber-500/10 text-amber-500 ring-amber-500/20"
                                    )}>
                                        <stat.icon className="w-6 h-6" />
                                    </div>
                                    <span className={cn(
                                        "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ring-1",
                                        isUp ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20" : "bg-amber-500/10 text-amber-500 ring-amber-500/20"
                                    )}>
                                        {stat.change}
                                    </span>
                                </div>
                                <div className="mt-8 relative z-10">
                                    <h3 className="text-4xl font-black tracking-tight">{stat.value}</h3>
                                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest mt-1 opacity-60">{stat.label}</p>
                                </div>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
            >
                <Card className="p-24 flex flex-col items-center justify-center text-center border-2 border-dashed border-primary/20 bg-card/20 backdrop-blur-xl rounded-[3rem] shadow-2xl relative overflow-hidden group mt-12">
                    <div className="absolute inset-0 bg-primary/[0.01] group-hover:bg-primary/[0.03] transition-colors duration-700" />

                    <div className="relative z-10">
                        <div className="p-6 rounded-[2.5rem] bg-secondary/50 mb-8 shadow-2xl ring-1 ring-white/10 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                            <TrendingUp className="w-12 h-12 text-muted-foreground/40" />
                        </div>
                        <h3 className="text-3xl font-black tracking-tight mb-4">Detailed charts coming soon</h3>
                        <p className="text-muted-foreground mt-4 max-w-sm text-lg font-medium leading-relaxed">
                            We are currently aggregating data from your connected platforms to build your unified growth map.
                        </p>

                        <div className="mt-12 flex gap-3 flex-wrap justify-center">
                            {['Retention', 'Audience Demo', 'Heatmaps', 'Geo-Analysis'].map(tag => (
                                <span key={tag} className="text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-secondary/30 rounded-xl ring-1 ring-white/5 opacity-40">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </Card>
            </motion.div>
        </div>
    );
};
