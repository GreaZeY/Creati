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
    <div className="space-y-8 pb-12 max-w-7xl mx-auto px-4">
      <PageHeader
        title="Analytics"
        description="Actionable intelligence across your entire creator footprint. Pure data, no noise."
      />

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 font-outfit">
        {isLoading ? (
          Array(4)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-3xl bg-card/20" />
            ))
        ) : (
          <>
            <LensedCard className="border-cyan-500/20">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Play size={20} />
                </div>
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest bg-cyan-500/5 px-2 py-1 rounded">
                  Reach
                </span>
              </div>
              <h3 className="text-3xl font-black tracking-tighter">
                {formatNumber(totalViews)}
              </h3>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1 opacity-60">
                Total Ecosystem Views
              </p>
            </LensedCard>

            <LensedCard className="border-magenta-500/20">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
                  <Zap size={20} />
                </div>
                <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest bg-pink-500/5 px-2 py-1 rounded">
                  Velocity
                </span>
              </div>
              <h3 className="text-3xl font-black tracking-tighter">
                {viralityCoef}
              </h3>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1 opacity-60">
                Virality Coefficient
              </p>
            </LensedCard>

            <LensedCard className="border-lime-500/20">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-lg bg-lime-500/10 text-lime-400">
                  <Target size={20} />
                </div>
                <span className="text-[10px] font-black text-lime-400 uppercase tracking-widest bg-lime-500/5 px-2 py-1 rounded">
                  Density
                </span>
              </div>
              <h3 className="text-3xl font-black tracking-tighter">
                {engagementDensity}%
              </h3>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1 opacity-60">
                Engagement Density
              </p>
            </LensedCard>

            <LensedCard className="border-primary/20">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <DollarSign size={20} />
                </div>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-2 py-1 rounded">
                  Revenue
                </span>
              </div>
              <h3 className="text-3xl font-black tracking-tighter">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <LensedCard className="lg:col-span-2 h-[450px] flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black uppercase tracking-tighter italic">
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
          <div className="flex-1 w-full min-h-[300px]">
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
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient
                    id="colorEngagement"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#f472b6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f472b6" stopOpacity={0} />
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
                  stroke="#22d3ee"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorReach)"
                />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  stroke="#f472b6"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorEngagement)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </LensedCard>

        <LensedCard className="flex flex-col p-10 border-primary/10">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <TrendingUp className="w-6 h-6 text-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
            </div>
            <h3 className="text-2xl font-black tracking-tighter italic uppercase">
              Resonance Mapping
            </h3>
          </div>

          <div className="flex-1 space-y-6">
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
              <div className="flex flex-col items-center justify-center py-20 opacity-40 border-dashed border-2 border-border rounded-3xl">
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">
                  Sector Data Pending
                </p>
              </div>
            )}
          </div>

          <div className="mt-10 p-5 bg-muted rounded-2xl border border-border relative overflow-hidden group">
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
