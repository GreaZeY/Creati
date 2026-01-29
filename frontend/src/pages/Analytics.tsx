import {
  BarChart3,
  TrendingUp,
  Play,
  Target,
  Zap,
  DollarSign,
} from "lucide-react";
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

// Mock data for the Pulse Chart (will be replaced by API)
const pulseData = [
  { name: "Mon", reach: 4500, engagement: 2400 },
  { name: "Tue", reach: 5200, engagement: 1398 },
  { name: "Wed", reach: 6800, engagement: 9800 },
  { name: "Thu", reach: 7100, engagement: 3908 },
  { name: "Fri", reach: 9100, engagement: 4800 },
  { name: "Sat", reach: 12000, engagement: 3800 },
  { name: "Sun", reach: 11000, engagement: 4300 },
];

export const Analytics = () => {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: async () => {
      const res = await analyticsAPI.getOverview();
      return res.data;
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
  const projectedRevenue = (totalViews * 0.002).toFixed(2); // Mock RPV of $0.002

  return (
    <div className="space-y-10 pb-20 max-w-7xl mx-auto px-4">
      <header className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 glass-card">
            <BarChart3 className="w-8 h-8 text-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter uppercase italic font-outfit">
            Ecosystem Pulse
          </h1>
        </div>
        <p className="text-muted-foreground text-lg font-medium max-w-2xl">
          Actionable intelligence across your entire creator footprint. Pure
          data, no noise.
        </p>
      </header>

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
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pulseData}>
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
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "rgba(255,255,255,0.3)",
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(10,10,12,0.9)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "16px",
                    backdropFilter: "blur(10px)",
                    fontSize: "12px",
                    fontFamily: "Outfit, sans-serif",
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

        <LensedCard className="flex flex-col justify-center items-center text-center p-10 border-dashed border-2 border-primary/10">
          <div className="p-6 rounded-3xl bg-primary/5 mb-6 ring-1 ring-primary/10">
            <TrendingUp className="w-12 h-12 text-primary/40 animate-pulse" />
          </div>
          <h3 className="text-2xl font-black tracking-tighter italic uppercase mb-4">
            Deep Resonance Mapping
          </h3>
          <p className="text-muted-foreground text-sm font-medium leading-relaxed opacity-60">
            Our neural engine is analyzing platform-specific resonance.
            Individual platform drill-downs arriving in next sync.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-2 w-full">
            {["LOYALTY", "DROPOFF", "GEO_SPARK", "CPM_TREND"].map((tag) => (
              <div
                key={tag}
                className="text-[9px] font-black py-2 bg-white/5 rounded-lg border border-white/5 opacity-30 tracking-widest"
              >
                {tag}
              </div>
            ))}
          </div>
        </LensedCard>
      </div>
    </div>
  );
};
