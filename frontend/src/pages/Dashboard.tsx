import { useQuery } from "@tanstack/react-query";
import { videosAPI, platformsAPI, analyticsAPI } from "@/lib/api";
import { VideoCard, VideoCardSkeleton } from "@/components/dashboard/VideoCard";
import {
  PlusCircle,
  UploadCloud,
  Link2,
  LayoutDashboard,
  ArrowRight,
  Zap,
  BarChart,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Link, useNavigate } from "react-router-dom";
import { LensedCard } from "@/components/ui/LensedCard";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";

export const Dashboard = () => {
  const navigate = useNavigate();

  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ["videos"],
    queryFn: async () => {
      const resp = await videosAPI.list();
      return resp.data.data;
    },
  });

  const { data: platforms = [], isLoading: platformsLoading } = useQuery({
    queryKey: ["platforms"],
    queryFn: async () => {
      const resp = await platformsAPI.list();
      return resp.data.data as any[];
    },
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: async () => {
      const res = await analyticsAPI.getOverview();
      return res.data;
    },
  });

  const isLoading = videosLoading || platformsLoading;
  const connectedPlatforms = Array.isArray(platforms)
    ? platforms.filter((p: any) => p.connected)
    : [];

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(num);
  };

  return (
    <div className="space-y-12 pb-20 max-w-7xl mx-auto px-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-4">
        <div className="space-y-2">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-6xl font-black tracking-tighter uppercase italic font-outfit"
          >
            Command Center
          </motion.h1>
          <p className="text-muted-foreground text-xl font-medium max-w-lg">
            Your global distribution engine is primed. Total control across all
            nodes.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Button
            asChild
            size="lg"
            className="h-16 px-10 rounded-2xl bg-primary text-slate-950 font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(var(--primary),0.3)] group border-0"
          >
            <Link to="/upload" className="flex items-center gap-3">
              <PlusCircle className="w-6 h-6 transition-transform group-hover:rotate-90 duration-500" />
              <span>INITIALIZE CONTENT</span>
            </Link>
          </Button>
        </motion.div>
      </header>

      {/* Hero Ecosystem Pulse */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 font-outfit">
        <LensedCard className="lg:col-span-2 border-primary/20 flex flex-col justify-center min-h-[220px]">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Zap size={18} fill="currentColor" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">
              Live Ecosystem Reach
            </span>
          </div>
          <div className="flex items-baseline gap-4">
            <h2 className="text-7xl font-black tracking-tighter">
              {analyticsLoading
                ? "---"
                : formatNumber(analytics?.totalViews || 0)}
            </h2>
            <span className="text-[12px] font-black text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full uppercase tracking-tighter ring-1 ring-emerald-400/20">
              +12.4% WEEKLY
            </span>
          </div>
          <p className="text-sm font-bold text-muted-foreground mt-4 opacity-40 uppercase tracking-widest">
            Aggregated performance across {connectedPlatforms.length} nodes
          </p>
        </LensedCard>

        <LensedCard className="border-cyan-500/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Link2 size={18} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">
              Node Status
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {isLoading ? (
              <Skeleton className="h-10 w-full rounded-xl bg-white/5" />
            ) : connectedPlatforms.length > 0 ? (
              connectedPlatforms.map((p: any) => (
                <div
                  key={p.id}
                  className="p-2 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2 group hover:bg-white/10 transition-all cursor-crosshair"
                >
                  <PlatformLogo
                    platform={p.platform}
                    size={14}
                    className="text-cyan-400"
                  />
                  <span className="text-[9px] font-black tracking-widest uppercase opacity-60 group-hover:opacity-100">
                    {p.platform}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">
                No Platforms Connected
              </span>
            )}
          </div>
          <div className="mt-auto pt-6">
            <button
              onClick={() => navigate("/platforms")}
              className="text-[10px] font-black text-cyan-400 uppercase tracking-widest hover:underline"
            >
              Link New Nodes →
            </button>
          </div>
        </LensedCard>

        <LensedCard className="border-magenta-500/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
              <LayoutDashboard size={18} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">
              Library Sync
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-5xl font-black">{videos.length}</span>
            <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">
              Assets Distributed
            </span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "78%" }}
              className="h-full bg-pink-500/50 shadow-[0_0_15px_rgba(244,114,182,0.5)]"
            />
          </div>
        </LensedCard>
      </div>

      {/* Recent Activity Section */}
      <div className="pt-8">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/5">
              <BarChart className="w-6 h-6 text-white/40" />
            </div>
            <h3 className="text-3xl font-black tracking-tighter uppercase italic font-outfit">
              Asset Feed
            </h3>
          </div>
          {videos.length > 3 && (
            <Button
              variant="ghost"
              className="font-black text-primary hover:bg-primary/5 group uppercase tracking-widest text-[10px]"
              onClick={() => navigate("/videos")}
            >
              Analyze All
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
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
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <LensedCard className="py-24 border-dashed border-2 border-white/5 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-8 ring-1 ring-white/10 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                <UploadCloud className="w-10 h-10 text-primary blur-[1px]" />
              </div>
              <h3 className="text-3xl font-black uppercase italic mb-4 tracking-tighter">
                Engine Standby
              </h3>
              <p className="text-muted-foreground mb-12 max-w-sm text-lg font-medium leading-relaxed opacity-60">
                No content detected in the pipeline. Initialize your first
                distribution to activate sensors.
              </p>
              <Button
                size="lg"
                className="h-16 px-12 rounded-2xl bg-white text-black font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-2xl"
                onClick={() => navigate("/upload")}
              >
                START DISPATCH
              </Button>
            </LensedCard>
          </motion.div>
        )}
      </div>
    </div>
  );
};
