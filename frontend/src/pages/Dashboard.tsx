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
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Link, useNavigate } from "react-router-dom";
import { LensedCard } from "@/components/ui/LensedCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { useClient } from "@/context/ClientContext";
import { ApprovalHub } from "@/components/dashboard/ApprovalHub";

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

  const { data: evergreen = [], isLoading: evergreenLoading } = useQuery({
    queryKey: ["evergreen-suggestions", selectedClient?.id],
    queryFn: async () => {
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL}/api/analytics/evergreen`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "X-Client-ID": selectedClient?.id?.toString() || "",
          },
        },
      ).then((res) => res.json());
      return resp.data;
    },
    enabled: !!selectedClient,
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
    <div className="h-full overflow-y-auto space-y-8 pb-12 max-w-7xl mx-auto px-8 w-full relative z-0">
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

      <ApprovalHub />

      {/* Hero Ecosystem Pulse */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 font-sans">
        <LensedCard className="lg:col-span-2 flex flex-col justify-center p-8 bg-white/80 dark:bg-card/40 border-0 ring-1 ring-border shadow-glass rounded-[2rem]">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-neon-purple/5 to-transparent pointer-events-none rounded-[2rem]" />
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-neon-purple/20 flex items-center justify-center text-neon-purple border border-neon-purple/30 shadow-glow-purple">
              <Zap size={20} className="fill-current" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest opacity-80">
              Live Ecosystem Reach
            </span>
          </div>
          <div className="flex items-baseline gap-4">
            <h2 className="text-5xl font-black font-display tracking-tighter text-foreground dark:text-white">
              {analyticsLoading
                ? "---"
                : formatNumber(analytics?.totalViews || 0)}
            </h2>
            <span className="flex items-center text-xs font-bold text-neon-lime bg-neon-lime/10 px-4 py-2 rounded-full border border-neon-lime/20 shadow-glow-lime">
              <ArrowRight className="w-4 h-4 mr-1 -rotate-45" /> +12.4%
            </span>
          </div>
          <p className="text-[11px] font-bold text-muted-foreground/40 mt-6 uppercase tracking-[0.2em]">
            Aggregated performance across {connectedPlatforms.length} active
            nodes
          </p>
          <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-neon-purple/20 rounded-full blur-[80px] pointer-events-none" />
        </LensedCard>

        <LensedCard className="lg:col-span-1 p-8 border-neon-blue/20 bg-gradient-to-br from-neon-blue/5 via-transparent to-transparent">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-neon-blue/20 flex items-center justify-center text-neon-blue border border-neon-blue/30 shadow-glow-blue">
              <Link2 size={20} />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest opacity-80">
              Node Status
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
            {isLoading ? (
              <Skeleton className="h-10 w-full rounded-2xl bg-white/5" />
            ) : connectedPlatforms.length > 0 ? (
              connectedPlatforms.map((p: any) => (
                <div
                  key={p.id}
                  className="px-3 py-2 rounded-xl bg-charcoal border border-white/5 flex items-center gap-2 group hover:border-neon-blue/40 transition-all cursor-pointer"
                >
                  <PlatformLogo
                    platform={p.platform}
                    size={14}
                    className="text-neon-blue"
                  />
                </div>
              ))
            ) : (
              <span className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest">
                Nodes Inactive
              </span>
            )}
          </div>
          <div className="mt-auto">
            <button
              onClick={() => navigate("/platforms")}
              className="text-xs font-bold text-neon-blue uppercase tracking-widest hover:text-white transition-colors"
            >
              Configure Nodes →
            </button>
          </div>
        </LensedCard>

        <LensedCard className="lg:col-span-1 p-8 border-neon-pink/20 bg-gradient-to-br from-neon-pink/5 via-transparent to-transparent">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-neon-pink/20 flex items-center justify-center text-neon-pink border border-neon-pink/30 shadow-glow-pink">
              <LayoutDashboard size={20} />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest opacity-80">
              Library Sync
            </span>
          </div>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-4xl font-black font-display tracking-tight text-foreground dark:text-white">
              {videos.length}
            </span>
            <span className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest">
              Distributed
            </span>
          </div>
          <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "78%" }}
              className="h-full bg-neon-pink shadow-glow-pink rounded-full relative"
            >
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 blur-[2px]" />
            </motion.div>
          </div>
        </LensedCard>
      </div>

      {/* Evergreen Strategy Suggester */}
      <div className="pt-8 space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neon-lime/20 flex items-center justify-center text-neon-lime border border-neon-lime/30 shadow-glow-lime">
              <RefreshCcw className="w-5 h-5" />
            </div>
            <h3 className="text-2xl font-black font-display tracking-tight text-foreground dark:text-white uppercase italic">
              Recycling Strategy
            </h3>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 px-4 py-2 bg-white/5 rounded-full border border-white/10">
            Top 10% Performance
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {evergreenLoading ? (
            [1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 bg-white/5 rounded-3xl animate-pulse border border-white/5"
              />
            ))
          ) : evergreen && evergreen.length > 0 ? (
            evergreen.map((item: any) => (
              <motion.div
                key={item.videoId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
              >
                <LensedCard className="p-6 bg-charcoal/40 border border-white/5 hover:border-neon-lime/30 transition-all group overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                    <Sparkles className="w-12 h-12 text-neon-lime" />
                  </div>
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="p-2 rounded-lg bg-white/5">
                      <PlatformLogo platform={item.platform} size={14} />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-neon-lime uppercase tracking-widest">
                        High Yield
                      </p>
                      <p className="text-xs font-bold text-white">
                        {formatNumber(item.totalViews)} Views
                      </p>
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-white/90 mb-6 line-clamp-1 group-hover:text-neon-lime transition-colors">
                    {item.title}
                  </h4>
                  <Button
                    variant="outline"
                    className="w-full border-neon-lime/20 text-neon-lime hover:bg-neon-lime/10 font-black uppercase tracking-widest text-[10px] h-9"
                    onClick={() =>
                      navigate(
                        `/create/${item.platform}?source=${item.externalId}`,
                      )
                    }
                  >
                    Reschedule Asset
                  </Button>
                </LensedCard>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-12 bg-white/5 rounded-[2rem] border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
              <p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest">
                Analytics pending for deep insights
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="pt-8 space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white border border-white/10">
              <BarChart className="w-5 h-5" />
            </div>
            <h3 className="text-2xl font-black font-display tracking-tight text-foreground dark:text-white uppercase italic">
              Asset Feed
            </h3>
          </div>
          {videos.length > 3 && (
            <Button
              variant="ghost"
              className="font-bold text-neon-purple hover:bg-neon-purple/5 group uppercase tracking-widest text-[10px]"
              onClick={() => navigate("/videos")}
            >
              Analyze All
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <VideoCardSkeleton key={i} />
            ))}
          </div>
        ) : videos.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
