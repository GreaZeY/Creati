import { useState } from "react";
import { LensedCard } from "@/components/ui/LensedCard";
import { StatusBadge } from "./StatusBadge";
import { Calendar, ExternalLink, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { VideoAnalytics } from "./VideoAnalytics";
import { Skeleton } from "@/components/ui/Skeleton";

interface VideoCardProps {
  video: {
    id: number;
    title: string;
    description: string;
    s3URL: string;
    status: string;
    createdAt: string;
    jobStatus: string;
  };
}

export const VideoCard = ({ video }: VideoCardProps) => {
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const date = new Date(video.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <LensedCard className="flex flex-col group h-full relative p-0 overflow-hidden ring-white/5 hover:ring-primary/20 transition-all">
      <div className="aspect-video bg-white/5 relative overflow-hidden border-b border-white/5">
        {/* Thumbnail placeholder with a subtle gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-cyan-500/5 flex items-center justify-center text-muted-foreground/10 group-hover:scale-105 transition-transform duration-700">
          <span className="text-5xl font-black italic tracking-tighter uppercase select-none opacity-20 font-outfit">
            Creati
          </span>
        </div>

        <div className="absolute top-4 right-4 z-10">
          <StatusBadge status={video.jobStatus} />
        </div>
      </div>

      <div className="p-6 flex flex-col flex-1 gap-5">
        <div className="space-y-2">
          <h3 className="font-black text-xl line-clamp-1 group-hover:text-primary transition-colors tracking-tight font-outfit uppercase italic">
            {video.title}
          </h3>
          <p className="text-sm text-muted-foreground/60 line-clamp-2 min-h-[2.5rem] font-medium leading-relaxed">
            {video.description || "No description provided."}
          </p>
        </div>

        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mt-auto">
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5">
            <Calendar className="w-3 h-3 text-primary/60" />
            {date}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-white/5">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-11 gap-2 rounded-xl font-black transition-all hover:bg-primary/10 hover:text-primary text-[10px] uppercase tracking-widest"
            onClick={() => setIsAnalyticsOpen(true)}
            disabled={video.jobStatus !== "completed"}
          >
            <BarChart2 className="w-4 h-4" />
            Intelligence
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-11 h-11 p-0 rounded-xl bg-white/5 border-white/5 hover:border-primary/20 transition-all"
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
