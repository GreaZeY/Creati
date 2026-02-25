import { useState } from "react";
import { LensedCard } from "@/components/ui/LensedCard";
import { StatusBadge } from "./StatusBadge";
import { Calendar, ExternalLink, BarChart2, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { VideoAnalytics } from "./VideoAnalytics";
import { Skeleton } from "@/components/ui/Skeleton";
import { videosAPI } from "@/lib/api";
import { toast } from "@/lib/events";

interface VideoCardProps {
  video: {
    id: number;
    title: string;
    description: string;
    s3URL: string;
    status: string;
    createdAt: string;
    jobStatus: string;
    isShort?: boolean;
  };
}

export const VideoCard = ({ video }: VideoCardProps) => {
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateShorts = async () => {
    setIsGenerating(true);
    try {
      await videosAPI.triggerShorts(video.id);
      toast.success("Magic Shorts generation started! Check back soon.");
    } catch (error) {
      toast.error("Failed to start Magic Shorts generation.");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const date = new Date(video.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <LensedCard className="flex flex-col group h-full relative p-0 overflow-hidden border-border/50 dark:border-white/5 hover:border-primary/20 dark:hover:border-white/20 transition-all duration-500 rounded-[32px]">
      <div className="aspect-video bg-secondary/50 dark:bg-charcoal relative overflow-hidden border-b border-border/50 dark:border-white/5 group-hover:bg-secondary/80 dark:group-hover:bg-midnight transition-colors duration-500">
        {/* Cinematic Thumbnail Mask */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none z-10" />

        {/* Thumbnail placeholder with a subtle gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/5 to-neon-blue/5 flex items-center justify-center text-muted-foreground/10 group-hover:scale-110 transition-transform duration-1000">
          <span className="text-5xl font-black italic tracking-tighter uppercase select-none opacity-20 font-display">
            Creati
          </span>
        </div>

        <div className="absolute top-6 right-6 z-20">
          <StatusBadge status={video.jobStatus} />
        </div>
      </div>

      <div className="p-8 flex flex-col flex-1 gap-6">
        <div className="space-y-3">
          <h3 className="font-bold text-xl line-clamp-1 text-foreground dark:text-white transition-colors tracking-tight font-display uppercase italic">
            {video.title}
          </h3>
          <p className="text-xs text-muted-foreground/40 line-clamp-2 min-h-[3rem] font-medium leading-relaxed uppercase tracking-wider">
            {video.description ||
              "System protocol initiated. Content distribution in progress."}
          </p>
        </div>

        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mt-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/30 dark:bg-white/5 rounded-full border border-border/50 dark:border-white/5">
            <Calendar className="w-3 h-3 text-neon-purple/60" />
            {date}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-6 border-t border-border/50 dark:border-white/5">
          {!video.isShort && (
            <Button
              variant="outline"
              size="sm"
              isLoading={isGenerating}
              className="h-11 gap-2 rounded-2xl font-bold transition-all hover:bg-yellow-500/10 hover:text-yellow-500 text-[10px] uppercase tracking-widest border border-transparent hover:border-yellow-500/30"
              onClick={handleGenerateShorts}
              disabled={video.jobStatus !== "completed"}
            >
              <Zap className="w-4 h-4 fill-current" />
              Magic Shorts
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-11 gap-2 rounded-2xl font-bold transition-all hover:bg-neon-purple/10 hover:text-neon-purple text-[10px] uppercase tracking-widest border border-transparent hover:border-neon-purple/30"
            onClick={() => setIsAnalyticsOpen(true)}
            disabled={video.jobStatus !== "completed"}
          >
            <BarChart2 className="w-4 h-4" />
            Intelligence
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="w-11 h-11 p-0 rounded-2xl bg-secondary/30 dark:bg-white/5 border border-border/50 dark:border-white/5 hover:border-primary/20 transition-all flex items-center justify-center shrink-0"
            asChild
          >
            <a href={video.s3URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </div>
      </div>

      {/* Analytics Modal */}
      <Modal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        title={`Intelligence: ${video.title}`}
      >
        <VideoAnalytics videoId={video.id} />
      </Modal>
    </LensedCard>
  );
};

export const VideoCardSkeleton = () => {
  return (
    <LensedCard className="flex flex-col p-0 h-full relative overflow-hidden">
      <Skeleton className="aspect-video rounded-none bg-white/5" />
      <div className="p-6 flex flex-col flex-1 gap-5">
        <div className="space-y-3">
          <Skeleton className="h-7 w-3/4 rounded-lg bg-white/5" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full rounded-md bg-white/5" />
            <Skeleton className="h-4 w-5/6 rounded-md bg-white/5" />
          </div>
        </div>
        <div className="mt-auto">
          <Skeleton className="h-6 w-24 rounded-lg bg-white/5" />
        </div>
        <div className="flex items-center gap-3 pt-4 border-t border-white/10">
          <Skeleton className="flex-1 h-11 rounded-xl bg-white/5" />
          <Skeleton className="w-11 h-11 rounded-xl bg-white/5" />
        </div>
      </div>
    </LensedCard>
  );
};
