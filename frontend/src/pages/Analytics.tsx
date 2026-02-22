import {
  TrendingUp,
  Play,
  Target,
  Zap,
  DollarSign,
  FileText,
  Download,
  Calendar,
  ExternalLink,
  Activity,
  Award,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { analyticsAPI, agencyAPI } from "@/lib/api";
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
import { motion, AnimatePresence } from "framer-motion";
import { useClient } from "@/context/ClientContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Switch } from "@/components/ui/Switch";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Globe, RefreshCw } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/events";

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
  const [isGlobal, setIsGlobal] = useState(false);
  const [activeTab, setActiveTab] = useState<"intelligence" | "reports">(
    "intelligence",
  );

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["analytics-overview", selectedClient?.id, isGlobal],
    queryFn: async () => {
      const res = await analyticsAPI.getOverview(selectedClient?.id, isGlobal);
      return res.data.data;
    },
  });

  const {
    data: reportData,
    isLoading: isReportLoading,
    refetch: refetchReport,
  } = useQuery({
    queryKey: ["client-report", selectedClient?.id],
    queryFn: async () => {
      if (!selectedClient) return null;
      const res = await agencyAPI.generateReport();
      return res.data.data;
    },
    enabled: activeTab === "reports" && !!selectedClient,
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(num);
  };

  const downloadReport = () => {
    if (!reportData) return;
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${reportData.clientName}_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    toast.success("Intelligence snapshot downloaded");
  };

  const totalViews = analytics?.totalViews || 0;
  const totalEngagement =
    (analytics?.totalLikes || 0) +
    (analytics?.totalComments || 0) +
    (analytics?.totalShares || 0);

  const viralityCoef =
    totalViews > 0
      ? (((analytics?.totalShares || 0) / totalViews) * 1000).toFixed(1)
      : "0.0";
  const engagementDensity =
    totalViews > 0 ? ((totalEngagement / totalViews) * 100).toFixed(1) : "0.0";
  const projectedRevenue =
    analytics?.projectedRevenue !== undefined
      ? analytics.projectedRevenue.toFixed(2)
      : (totalViews * 0.002).toFixed(2);

  return (
    <div className="h-full overflow-y-auto space-y-8 pb-12 max-w-7xl mx-auto px-8 w-full relative z-0">
      <PageHeader
        title={
          activeTab === "reports"
            ? "Performance Briefings"
            : isGlobal
              ? "Agency Intelligence"
              : "Creator Intelligence"
        }
        description={
          activeTab === "reports"
            ? "Automated white-labeled snapshots optimized for client transparency and strategic review."
            : isGlobal
              ? "Aggregated impact across all client nodes and distribution networks."
              : "Actionable intelligence across your entire creator footprint. Pure data, no noise."
        }
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center p-1 bg-secondary/30 rounded-2xl border border-border/50">
            <button
              onClick={() => setActiveTab("intelligence")}
              className={cn(
                "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === "intelligence"
                  ? "bg-primary text-white shadow-xl shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Intelligence
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={cn(
                "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === "reports"
                  ? "bg-primary text-white shadow-xl shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Reports
            </button>
          </div>

          <div className="flex items-center gap-3 bg-secondary/30 px-4 py-2 rounded-2xl border border-border/50">
            <Globe
              className={cn(
                "w-4 h-4",
                isGlobal
                  ? "text-primary shadow-glow-blue"
                  : "text-muted-foreground",
              )}
            />
            <Label
              htmlFor="global-toggle"
              className="text-[10px] font-black uppercase tracking-widest cursor-pointer"
            >
              Global View
            </Label>
            <Switch
              id="global-toggle"
              checked={isGlobal}
              onCheckedChange={setIsGlobal}
            />
          </div>
        </div>
      </PageHeader>

      <AnimatePresence mode="wait">
        {activeTab === "intelligence" ? (
          <motion.div
            key="intelligence"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Hero Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-outfit">
              {isLoading ? (
                Array(4)
                  .fill(0)
                  .map((_, i) => (
                    <Skeleton
                      key={i}
                      className="h-32 rounded-2xl bg-secondary"
                    />
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
                      <div className="w-2 h-2 rounded-full bg-pink-400" />{" "}
                      Engagement
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
                        <linearGradient
                          id="colorReach"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#0ea5e9"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="95%"
                            stopColor="#0ea5e9"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="colorEngagement"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#a855f7"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="95%"
                            stopColor="#a855f7"
                            stopOpacity={0}
                          />
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
                        itemStyle={{
                          fontWeight: 900,
                          textTransform: "uppercase",
                        }}
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
                              width: `${totalViews > 0 ? (platform.views / totalViews) * 100 : 0}%`,
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
              </LensedCard>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="reports"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {!selectedClient ? (
              <div className="p-20 text-center rounded-[3rem] border-2 border-dashed border-border/50 bg-secondary/10">
                <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-bold uppercase tracking-tight">
                  Access Denied
                </h3>
                <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
                  Select a specific distribution node to generate a performance
                  briefing.
                </p>
              </div>
            ) : isReportLoading ? (
              <div className="p-20 text-center animate-pulse opacity-40">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">
                  Compiling briefing...
                </p>
              </div>
            ) : reportData ? (
              <div className="max-w-4xl mx-auto space-y-6 pb-20">
                <LensedCard className="p-8 border-0 bg-white/40 dark:bg-card/40 backdrop-blur-3xl ring-1 ring-border rounded-[2.5rem] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 flex gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => refetchReport()}
                      className="rounded-xl border-border/50 hover:bg-muted/50 transition-all font-black uppercase tracking-widest text-[9px]"
                    >
                      <RefreshCw className="w-3 h-3 mr-2" />
                      Regenerate
                    </Button>
                    <Button
                      size="sm"
                      onClick={downloadReport}
                      className="rounded-xl font-black uppercase tracking-widest text-[9px] shadow-xl shadow-primary/20"
                    >
                      <Download className="w-3 h-3 mr-2" />
                      Export Briefing
                    </Button>
                  </div>

                  <div className="flex items-center gap-6 mb-12">
                    <div
                      className="w-20 h-20 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black shadow-2xl ring-4 ring-background"
                      style={{ backgroundColor: reportData.brandColor }}
                    >
                      {reportData.logoUrl ? (
                        <img
                          src={reportData.logoUrl}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        reportData.clientName.charAt(0)
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-black tracking-tight">
                          {reportData.clientName}
                        </h2>
                        <div className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[9px] font-black uppercase tracking-widest">
                          Strategic Briefing
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">
                            {reportData.timeRange}
                          </span>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-border" />
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">
                            Efficiency:{" "}
                            {reportData.summary.efficiency.toFixed(1)}x
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="space-y-1 p-4 rounded-2xl bg-secondary/20 border border-border/50">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        Total Impressions
                      </p>
                      <p className="text-2xl font-black tracking-tight">
                        {formatNumber(reportData.summary.totalReach)}
                      </p>
                    </div>
                    <div className="space-y-1 p-4 rounded-2xl bg-secondary/20 border border-border/50">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        Total Reactions
                      </p>
                      <p className="text-2xl font-black tracking-tight">
                        {formatNumber(reportData.summary.totalEngagement)}
                      </p>
                    </div>
                    <div className="space-y-1 p-4 rounded-2xl bg-secondary/20 border border-border/50">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        Node Efficiency
                      </p>
                      <p className="text-2xl font-black tracking-tight text-primary">
                        {reportData.summary.efficiency.toFixed(1)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      <h3 className="text-xs font-black uppercase tracking-widest">
                        Prime Distribution Performers
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {reportData.topPerforming?.map((v: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/40 dark:bg-black/20 ring-1 ring-border hover:ring-primary/30 transition-all group/item"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center font-black text-xs">
                              {i + 1}
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="text-xs font-bold truncate max-w-[200px]">
                                {v.title}
                              </h4>
                              <div className="flex items-center gap-2">
                                <PlatformLogo
                                  platform={v.platform}
                                  size={10}
                                  className="text-primary"
                                />
                                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                                  {v.platform}
                                </span>
                                <span className="text-[8px] opacity-20">•</span>
                                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                                  {new Date(v.published).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-[9px] font-black uppercase tracking-tighter opacity-40">
                                Views
                              </p>
                              <p className="text-xs font-black">
                                {formatNumber(v.views)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black uppercase tracking-tighter opacity-40">
                                Eng
                              </p>
                              <p className="text-xs font-black">
                                {formatNumber(v.engagement)}
                              </p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="opacity-0 group-hover/item:opacity-100 h-8 w-8"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </LensedCard>
                <p className="text-center text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em]">
                  Briefing strictly confidential • Powered by Creati
                  Intelligence Node
                </p>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
