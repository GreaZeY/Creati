import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LensedCard } from "@/components/ui/LensedCard";
import { BarChart3, TrendingUp, Users, Play, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

export function SharedReport() {
  const { clientId } = useParams();

  const {
    data: report,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["public-report", clientId],
    queryFn: async () => {
      const resp = await api.get(`/pub/analytics/${clientId}`);
      return resp.data.data;
    },
  });

  if (isLoading)
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-8">
        <div className="w-full max-w-4xl space-y-8 animate-pulse">
          <div className="h-20 bg-slate-100 dark:bg-card/40 rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 bg-slate-100 dark:bg-card/40 rounded-3xl"
              />
            ))}
          </div>
          <div className="h-96 bg-slate-100 dark:bg-card/40 rounded-3xl" />
        </div>
      </div>
    );

  if (error || !report)
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-8">
        <div className="space-y-4">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">
            Report Unavailable
          </h2>
          <p className="text-muted-foreground">
            The link might be expired or the client ID is invalid.
          </p>
        </div>
      </div>
    );

  const stats = [
    {
      label: "Total Reach",
      value: report.metrics.totalViews.toLocaleString(),
      icon: <Play size={20} />,
      color: "text-blue-500",
    },
    {
      label: "Engagement",
      value: report.metrics.totalLikes.toLocaleString(),
      icon: <TrendingUp size={20} />,
      color: "text-pink-500",
    },
    {
      label: "Community",
      value: report.metrics.totalComments.toLocaleString(),
      icon: <Users size={20} />,
      color: "text-purple-500",
    },
    {
      label: "Assets",
      value: report.metrics.totalVideos.toLocaleString(),
      icon: <Calendar size={20} />,
      color: "text-amber-500",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#020202] text-slate-900 dark:text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* White-Labeled Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 md:p-8 bg-white dark:bg-card/40 border border-slate-100 dark:border-white/5 shadow-glass rounded-2xl md:rounded-[2.5rem] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full -mr-32 -mt-32" />

          <div className="flex items-center gap-4 md:gap-6 relative z-10">
            {report.logoUrl ? (
              <img
                src={report.logoUrl}
                alt={report.clientName}
                className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl object-contain bg-slate-50 p-2"
              />
            ) : (
              <div
                className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center text-white font-black text-xl md:text-2xl shadow-glow"
                style={{ backgroundColor: report.brandColor }}
              >
                {report.clientName[0]}
              </div>
            )}
            <div>
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-1">
                Live Performance Briefing
              </p>
              <h1 className="text-xl md:text-3xl font-black italic uppercase tracking-tight font-display">
                {report.clientName}
              </h1>
            </div>
          </div>

          <div className="flex flex-col md:items-end justify-center md:justify-end gap-1 relative z-10 border-t md:border-t-0 border-slate-100 dark:border-white/5 pt-4 md:pt-0 mt-2 md:mt-0">
            <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-muted-foreground/40 mb-1 md:mb-0">
              Agency Insights
            </p>
            <div className="px-3 py-1.5 bg-black text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-lg border border-white/10 w-fit md:w-auto">
              Creati <span className="text-primary italic">OS</span>
            </div>
          </div>
        </motion.div>

        {/* High-Impact Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <LensedCard className="p-4 md:p-6 bg-white/80 dark:bg-card/40 border-0 ring-1 ring-slate-100 dark:ring-white/5 shadow-glass rounded-2xl md:rounded-3xl group">
                <div className="flex items-center justify-between mb-2 md:mb-4">
                  <div
                    className={`p-2 md:p-2.5 rounded-lg md:rounded-xl bg-slate-50 dark:bg-white/5 ${stat.color} group-hover:scale-110 transition-transform`}
                  >
                    {stat.icon}
                  </div>
                </div>
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-muted-foreground/60">
                  {stat.label}
                </p>
                <h3 className="text-lg md:text-2xl font-black font-display tracking-tighter mt-1">
                  {stat.value}
                </h3>
              </LensedCard>
            </motion.div>
          ))}
        </div>

        {/* Charts & Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Growth Chart */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="lg:col-span-2 p-8 bg-white/80 dark:bg-card/40 border-0 ring-1 ring-slate-100 dark:ring-white/5 shadow-glass rounded-[2rem]"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <BarChart3 size={16} className="text-primary" />
                Ecosystem Growth
              </h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={report.metrics.platformBreakdown}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={report.brandColor}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={report.brandColor}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="platform"
                    stroke="#888888"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#000",
                      border: "none",
                      borderRadius: "12px",
                      fontSize: "10px",
                    }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke={report.brandColor}
                    fillOpacity={1}
                    fill="url(#colorViews)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Platform Split */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-8 bg-white/80 dark:bg-card/40 border-0 ring-1 ring-slate-100 dark:ring-white/5 shadow-glass rounded-[2rem]"
          >
            <h3 className="text-sm font-black uppercase tracking-widest mb-8">
              Platform Split
            </h3>
            <div className="space-y-6">
              {report.metrics.platformBreakdown.map((platform: any) => (
                <div key={platform.platform} className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>{platform.platform}</span>
                    <span className="text-slate-900 dark:text-white">
                      {Math.round(
                        (platform.views / report.metrics.totalViews) * 100,
                      )}
                      %
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(platform.views / report.metrics.totalViews) * 100}%`,
                      }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: report.brandColor }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-slate-100 dark:border-white/5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-muted-foreground/40 italic">
            Confidential Reporting &copy; {new Date().getFullYear()}{" "}
            {report.clientName} x Creati
          </p>
        </div>
      </div>
    </div>
  );
}
