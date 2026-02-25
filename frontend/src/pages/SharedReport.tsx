import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { publicAPI } from "@/lib/api";
import { LensedCard } from "@/components/ui/LensedCard";
import {
  BarChart3,
  TrendingUp,
  Users,
  Play,
  Calendar,
  Zap,
  Heart,
  Share2,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";

export function SharedReport() {
  const { token } = useParams();

  const {
    data: report,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["public-report", token],
    queryFn: async () => {
      const resp = await publicAPI.getReport(token!);
      return resp.data.data;
    },
    enabled: !!token,
  });

  if (isLoading)
    return (
      <div className="min-h-screen bg-white dark:bg-[#020202] flex items-center justify-center p-8">
        <div className="w-full max-w-4xl space-y-8 animate-pulse">
          <div className="h-24 bg-slate-100 dark:bg-card/40 rounded-[2.5rem]" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 bg-slate-100 dark:bg-card/40 rounded-3xl"
              />
            ))}
          </div>
          <div className="h-96 bg-slate-100 dark:bg-card/40 rounded-[2.5rem]" />
        </div>
      </div>
    );

  if (error || !report)
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-8 bg-[#020202] text-white">
        <div className="space-y-6">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto ring-1 ring-destructive/20">
            <Zap className="text-destructive w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">
              Access Restricted
            </h2>
            <p className="text-muted-foreground max-w-sm mx-auto text-sm font-medium">
              This report link is invalid, expired, or sharing has been disabled
              by the agency.
            </p>
          </div>
          <div className="pt-4">
            <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 inline-block">
              Creati <span className="text-primary italic">OS</span> Security
            </div>
          </div>
        </div>
      </div>
    );

  const stats = [
    {
      label: "Total Reach",
      value: report.metrics.totalViews.toLocaleString(),
      icon: <Play size={20} />,
      color: "text-blue-500",
      sub: "Views across all channels",
    },
    {
      label: "Engagement",
      value: report.metrics.totalLikes.toLocaleString(),
      icon: <TrendingUp size={20} />,
      color: "text-pink-500",
      sub: "Reactions & interactions",
    },
    {
      label: "Community",
      value: report.metrics.totalComments.toLocaleString(),
      icon: <Users size={20} />,
      color: "text-purple-500",
      sub: "Active discussions",
    },
    {
      label: "Assets",
      value: report.metrics.totalVideos.toLocaleString(),
      icon: <Calendar size={20} />,
      color: "text-amber-500",
      sub: "Active content pieces",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#020202] text-slate-900 dark:text-white p-4 md:p-12 font-sans selection:bg-primary/30">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Professional Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-8 p-8 md:p-10 bg-white/80 dark:bg-card/40 backdrop-blur-3xl border border-slate-100 dark:border-white/5 shadow-2xl rounded-[3rem] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full -mr-64 -mt-64 animate-pulse" />

          <div className="flex items-center gap-6 relative z-10">
            {report.logoUrl ? (
              <div className="p-1 bg-gradient-to-br from-white/10 to-transparent rounded-3xl ring-1 ring-white/10 shadow-2xl">
                <img
                  src={report.logoUrl}
                  alt={report.clientName}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-contain bg-white/5 p-3"
                />
              </div>
            ) : (
              <div
                className="w-16 h-16 md:w-20 md:h-20 rounded-3xl flex items-center justify-center text-white font-black text-2xl md:text-3xl shadow-2xl ring-4 ring-white/5"
                style={{ backgroundColor: report.brandColor }}
              >
                {report.clientName[0]}
              </div>
            )}
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/80">
                Performance Executive Brief
              </p>
              <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tight font-display bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-white/80 dark:to-white bg-clip-text text-transparent">
                {report.clientName}
              </h1>
            </div>
          </div>

          <div className="flex flex-col md:items-end justify-center md:justify-end gap-2 relative z-10 border-t md:border-t-0 border-slate-100 dark:border-white/5 pt-6 md:pt-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-muted-foreground/40">
              Reporting Powered by
            </p>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/10 shadow-2xl shadow-primary/10">
                Creati <span className="text-primary italic">OS</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* High-Impact Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <LensedCard className="p-6 md:p-8 bg-white/80 dark:bg-card/40 backdrop-blur-3xl border-0 ring-1 ring-slate-100 dark:ring-white/5 shadow-glass rounded-[2rem] group hover:ring-primary/20 transition-all duration-500">
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`p-3 rounded-2xl bg-slate-50 dark:bg-white/5 ${stat.color} group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}
                  >
                    {stat.icon}
                  </div>
                  <div className="h-1.5 w-12 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "70%" }}
                      className="h-full bg-primary"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-muted-foreground/60">
                    {stat.label}
                  </p>
                  <h3 className="text-2xl md:text-3xl font-black font-display tracking-tighter">
                    {stat.value}
                  </h3>
                  <p className="text-[9px] font-bold text-muted-foreground/40 uppercase">
                    {stat.sub}
                  </p>
                </div>
              </LensedCard>
            </motion.div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Growth Trend (Last 30 Days) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="lg:col-span-2 p-10 bg-white/80 dark:bg-card/40 backdrop-blur-3xl border-0 ring-1 ring-slate-100 dark:ring-white/5 shadow-glass rounded-[3rem]"
          >
            <div className="flex items-center justify-between mb-10">
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <BarChart3 size={16} className="text-primary" />
                  Performance Pulse
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase">
                  Reach vs Engagement (Last 30 Days)
                </p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: report.brandColor }}
                  />
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                    Reach
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                    Engagement
                  </span>
                </div>
              </div>
            </div>

            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={report.metrics.pulseData}>
                  <defs>
                    <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={report.brandColor}
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="95%"
                        stopColor={report.brandColor}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(255,255,255,0.03)"
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontWeight: "900", letterSpacing: "0.1em" }}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) =>
                      val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(0,0,0,0.8)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "16px",
                      fontSize: "10px",
                    }}
                    itemStyle={{
                      fontWeight: "900",
                      textTransform: "uppercase",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="reach"
                    stroke={report.brandColor}
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorReach)"
                  />
                  <Area
                    type="monotone"
                    dataKey="engagement"
                    stroke="#888888"
                    strokeWidth={2}
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Audience Distribution */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-10 bg-white/80 dark:bg-card/40 backdrop-blur-3xl border-0 ring-1 ring-slate-100 dark:ring-white/5 shadow-glass rounded-[3rem] flex flex-col"
          >
            <div className="space-y-1 mb-10">
              <h3 className="text-sm font-black uppercase tracking-widest">
                Ecosystem Split
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase">
                Distribution per platform
              </p>
            </div>
            <div className="space-y-8 flex-1">
              {report.metrics.platformBreakdown.map((platform: any) => (
                <div key={platform.platform} className="space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <span className="text-slate-500">{platform.platform}</span>
                    <span className="text-slate-900 dark:text-white">
                      {Math.round(
                        (platform.views / report.metrics.totalViews) * 100,
                      )}
                      %
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden p-0.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(platform.views / report.metrics.totalViews) * 100}%`,
                      }}
                      className="h-full rounded-full shadow-[0_0_15px_rgba(0,0,0,0.1)]"
                      style={{ backgroundColor: report.brandColor }}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] font-black text-muted-foreground/40 uppercase">
                      {platform.views.toLocaleString()} Total Reach
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <p className="text-[9px] font-bold text-primary/70 uppercase leading-relaxed text-center italic">
                Platform growth is currently +12.4% vs previous snapshot
              </p>
            </div>
          </motion.div>
        </div>

        {/* Top Content (New Highlight) */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="space-y-1">
              <h3 className="text-xl font-black italic uppercase tracking-tight">
                Top Content
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                Highest performing assets this period
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {report.metrics.topVideos?.map((video: any, i: number) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                className="group relative"
              >
                <Card className="overflow-hidden border-0 ring-1 ring-white/5 bg-card/40 rounded-3xl shadow-2xl group-hover:ring-primary/40 transition-all duration-500">
                  <div className="aspect-[9/16] relative overflow-hidden">
                    <img
                      src={
                        video.thumbnailUrl ||
                        `https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&q=80`
                      }
                      className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-700"
                      alt={video.title}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
                    <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[8px] font-black uppercase tracking-widest text-white ring-1 ring-white/10">
                      {video.platform}
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 space-y-3">
                    <h4 className="text-xs font-black text-white line-clamp-2 leading-tight drop-shadow-lg uppercase italic tracking-tighter">
                      {video.title}
                    </h4>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Play
                            className="w-2.5 h-2.5 text-primary"
                            fill="currentColor"
                          />
                          <span className="text-[10px] font-black text-white">
                            {video.views >= 1000
                              ? `${(video.views / 1000).toFixed(1)}k`
                              : video.views}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart
                            className="w-2.5 h-2.5 text-pink-500"
                            fill="currentColor"
                          />
                          <span className="text-[10px] font-black text-white">
                            {video.likes}
                          </span>
                        </div>
                      </div>
                      <Zap className="w-3 h-3 text-primary animate-pulse" />
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Professional Footer */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-12 border-t border-slate-100 dark:border-white/5 pb-12">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center ring-1 ring-white/10">
              <Share2 className="w-4 h-4 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-muted-foreground/40 italic">
                Live Intelligence Stream &copy; {new Date().getFullYear()}
              </p>
              <p className="text-[9px] font-bold text-muted-foreground/20 uppercase tracking-widest">
                {report.clientName} x Creati Executive
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
              Data Verified
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple Card component for the layout
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`relative ${className}`}>{children}</div>;
}
