import { useQuery } from "@tanstack/react-query";
import { videosAPI, platformsAPI, analyticsAPI } from "@/lib/api";
import { VideoCard, VideoCardSkeleton } from "@/components/dashboard/VideoCard";
import {
  UploadCloud,
  Zap,
  Plus,
  Link2,
  LayoutDashboard,
  ArrowRight,
  BarChart,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Link, useNavigate } from "react-router-dom";
import { LensedCard } from "@/components/ui/LensedCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { useClient } from "@/context/ClientContext";

export const Dashboard = () => {
  const navigate = useNavigate();
  const { selectedClient } = useClient();

  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ["videos", selectedClient?.id],
    queryFn: async () => {
      const resp = await videosAPI.list(selectedClient?.id);
      return resp.data.data;
    },
  });

  const { data: platforms = [], isLoading: platformsLoading } = useQuery({
    queryKey: ["platforms", selectedClient?.id],
    queryFn: async () => {
      const resp = await platformsAPI.list(selectedClient?.id);
      return resp.data.data as any[];
    },
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics-overview", selectedClient?.id],
    queryFn: async () => {
      const res = await analyticsAPI.getOverview(selectedClient?.id);
      return res.data.data;
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
    <div className="space-y-8 pb-12 max-w-7xl mx-auto px-4">
      <PageHeader
        title="Dashboard"
        description="Your global distribution engine is primed. Total control across all nodes."
      >
        <Link to="/upload">
          <Button className="gap-2">
            <Plus size={18} />
            Initialize Content
          </Button>
        </Link>
      </PageHeader>

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
            <h2 className="text-5xl font-black tracking-tighter">
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
              <Skeleton className="h-10 w-full rounded-xl bg-muted/50" />
            ) : connectedPlatforms.length > 0 ? (
              connectedPlatforms.map((p: any) => (
                <div
                  key={p.id}
                  className="p-2 rounded-xl bg-muted/30 border border-border flex items-center gap-2 group hover:bg-accent/10 transition-all cursor-crosshair"
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
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-black">{videos.length}</span>
            <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">
              Assets Distributed
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "78%" }}
              className="h-full bg-pink-500/50 shadow-[0_0_15px_rgba(244,114,182,0.5)]"
            />
          </div>
        </LensedCard>
      </div>

      {/* Recent Activity Section */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <BarChart className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-bold tracking-tight uppercase italic font-outfit">
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
            <LensedCard className="py-12 border-dashed border-2 border-border flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-6 ring-1 ring-border group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                <UploadCloud className="w-8 h-8 text-primary blur-[0.5px]" />
              </div>
              <h3 className="text-lg font-bold uppercase italic mb-2 tracking-tight">
                Engine Standby
              </h3>
              <p className="text-muted-foreground mb-8 max-w-sm text-sm font-medium leading-relaxed opacity-60">
                No content detected in the pipeline. Initialize your first
                distribution to activate sensors.
              </p>
              <Button
                size="lg"
                className="h-12 px-10 rounded-xl bg-foreground text-background font-bold text-base hover:scale-105 active:scale-95 transition-all shadow-xl"
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
