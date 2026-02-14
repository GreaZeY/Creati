import { TrendingUp, Play, Target, Zap, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { analyticsAPI } from "@/lib/api";
import { LensedCard } from "@/components/ui/LensedCard";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { motion } from "framer-motion";
import { useClient } from "@/context/ClientContext";
import { PageHeader } from "@/components/ui/PageHeader";

// Fallback mock data if no history yet
const mockPulseData = [
  { name: "Mon", reach: 0, engagement: 0 },
  { name: "Tue", reach: 0, engagement: 0 },
  { name: "Wed", reach: 0, engagement: 0 },
  { name: "Thu", reach: 0, engagement: 0 },
  { name: "Fri", reach: 0, engagement: 0 },
  { name: "Sat", reach: 0, engagement: 0 },
  { name: "Sun", reach: 0, engagement: 0 },
];

export const Analytics = () => {
  const { selectedClient } = useClient();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["analytics-overview", selectedClient?.id],
    queryFn: async () => {
      const res = await analyticsAPI.getOverview(selectedClient?.id);
      return res.data.data;
    },
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(num);
  };

  const totalViews = analytics?.totalViews || 0;
  const totalEngagement =
    (analytics?.totalLikes || 0) +
    (analytics?.totalComments || 0) +
    (analytics?.totalShares || 0);

  // High-End Metrics Calculations
  const viralityCoef =
    totalViews > 0
      ? (((analytics?.totalShares || 0) / totalViews) * 1000).toFixed(1)
      : "0.0";
  const engagementDensity =
    totalViews > 0 ? ((totalEngagement / totalViews) * 100).toFixed(1) : "0.0";
  const projectedRevenue =
    analytics?.projectedRevenue !== undefined
      ? analytics.projectedRevenue.toFixed(2)
      : (totalViews * 0.002).toFixed(2); // Fallback to mock RPV

  return (
    <div className="h-full overflow-y-auto space-y-8 pb-12 max-w-7xl mx-auto px-8 w-full relative z-0">
      <PageHeader
        title="Creator Intelligence"
        description="Actionable intelligence across your entire creator footprint. Pure data, no noise."
      />

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-outfit">
        {isLoading ? (
          Array(4)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl bg-secondary" />
            ))
        ) : (
          <>
            <LensedCard className="bg-white/80 dark:bg-card/40 border-0 ring-1 ring-border shadow-glass p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500 shadow-glow-blue/10">
                  <Play size={18} />
                </div>
                <span className="text-xs font-bold text-cyan-500 uppercase tracking-widest bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                  Total Reach
                </span>
              </div>
              <h3 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">
                {formatNumber(totalViews)}
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-muted-foreground uppercase font-black tracking-[0.2em] mt-2 opacity-60">
                Ecosystem Views
              </p>
            </LensedCard>

            <LensedCard className="border-magenta-500/20 p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400">
                  <Zap size={16} />
                </div>
                <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest bg-pink-500/5 px-2 py-1 rounded">
                  Velocity
                </span>
              </div>
              <h3 className="text-xl font-black tracking-tighter text-foreground dark:text-white">
                {viralityCoef}
              </h3>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1 opacity-60">
                Virality Coefficient
              </p>
            </LensedCard>

            <LensedCard className="border-lime-500/20 p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="p-1.5 rounded-lg bg-lime-500/10 text-lime-400">
                  <Target size={16} />
                </div>
                <span className="text-[10px] font-black text-lime-400 uppercase tracking-widest bg-lime-500/5 px-2 py-1 rounded">
                  Density
                </span>
              </div>
              <h3 className="text-xl font-black tracking-tighter text-foreground dark:text-white">
                {engagementDensity}%
              </h3>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1 opacity-60">
                Engagement Density
              </p>
            </LensedCard>

            <LensedCard className="border-primary/20 p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <DollarSign size={16} />
                </div>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-2 py-1 rounded">
                  Revenue
                </span>
              </div>
              <h3 className="text-xl font-black tracking-tighter text-foreground dark:text-white">
                ${projectedRevenue}
              </h3>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1 opacity-60">
                Projected Earnings
              </p>
            </LensedCard>
          </>
        )}
      </div>

      {/* Pulse Chart Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <LensedCard className="lg:col-span-2 h-[360px] flex flex-col p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold uppercase tracking-tight italic">
              Combined Growth Map
            </h3>
            <div className="flex gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-cyan-400" /> Reach
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-black text-pink-400 uppercase tracking-widest ml-4">
                <div className="w-2 h-2 rounded-full bg-pink-400" /> Engagement
              </span>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={
                  analytics?.pulseData?.length
                    ? analytics.pulseData
                    : mockPulseData
                }
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient
                    id="colorEngagement"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "16px",
                    backdropFilter: "blur(10px)",
                    fontSize: "12px",
                    fontFamily: "Outfit, sans-serif",
                    color: "hsl(var(--popover-foreground))",
                  }}
                  itemStyle={{ fontWeight: 900, textTransform: "uppercase" }}
                />
                <Area
                  type="monotone"
                  dataKey="reach"
                  stroke="#0ea5e9"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorReach)"
                  animationDuration={2000}
                />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  stroke="#a855f7"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorEngagement)"
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </LensedCard>

        <LensedCard className="flex flex-col p-4 border-primary/10">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <TrendingUp className="w-4 h-4 text-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
            </div>
            <h3 className="text-sm font-bold tracking-tight italic uppercase">
              Resonance Mapping
            </h3>
          </div>

          <div className="flex-1 space-y-4">
            {analytics?.platformBreakdown?.length ? (
              analytics.platformBreakdown.map((platform: any) => (
                <div key={platform.platform} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2">
                      <PlatformLogo
                        platform={platform.platform}
                        size={12}
                        className="text-primary"
                      />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-50">
                        {platform.platform}
                      </span>
                    </div>
                    <span className="text-sm font-black tracking-tighter font-outfit">
                      {formatNumber(platform.views)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden ring-1 ring-border">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${
                          totalViews > 0
                            ? (platform.views / totalViews) * 100
                            : 0
                        }%`,
                      }}
                      className="h-full bg-primary/40 shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 opacity-40 border-dashed border-2 border-border rounded-2xl">
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">
                  Sector Data Pending
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-muted rounded-xl border border-border relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <p className="relative z-10 text-[9px] font-black text-muted-foreground uppercase leading-relaxed tracking-[0.2em] text-center">
              Neural engine prioritizing high-affinity sectors. <br />
              <span className="text-primary/60">
                Optimal distribution nodes identified.
              </span>
            </p>
          </div>
        </LensedCard>
      </div>
    </div>
  );
};
