import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from './StatusBadge';
import { Calendar, ExternalLink, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { VideoAnalytics } from './VideoAnalytics';
import { Skeleton } from '@/components/ui/Skeleton';

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
    const date = new Date(video.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    return (
        <Card className="flex flex-col border-0 bg-card/40 backdrop-blur-xl group h-full relative overflow-hidden rounded-[2rem] ring-1 ring-white/10 hover:ring-primary/30 transition-all duration-500 shadow-xl hover:shadow-primary/5">
            <div className="aspect-video bg-secondary/30 relative overflow-hidden">
                {/* Thumbnail placeholder with a subtle gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-cyan-500/5 flex items-center justify-center text-muted-foreground/10 group-hover:scale-105 transition-transform duration-700">
                    <span className="text-5xl font-black italic tracking-tighter uppercase select-none">Creati</span>
                </div>

                <div className="absolute top-4 right-4 z-10">
                    <StatusBadge status={video.jobStatus} />
                </div>

                {/* Overlay glow on hover */}
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>

            <div className="p-6 flex flex-col flex-1 gap-5 relative z-10">
                <div className="space-y-2">
                    <h3 className="font-black text-xl line-clamp-1 group-hover:text-primary transition-colors tracking-tight">
                        {video.title}
                    </h3>
                    <p className="text-sm text-muted-foreground/80 line-clamp-2 min-h-[2.5rem] font-medium leading-relaxed">
                        {video.description || 'No description provided.'}
                    </p>
                </div>

                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mt-auto">
                    <div className="flex items-center gap-2 px-3 py-1 bg-secondary/50 rounded-lg ring-1 ring-white/5">
                        <Calendar className="w-3 h-3 text-primary" />
                        {date}
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-11 gap-2 rounded-xl font-black transition-all hover:bg-primary/10 hover:text-primary text-xs"
                        onClick={() => setIsAnalyticsOpen(true)}
                        disabled={video.jobStatus !== 'completed'}
                    >
                        <BarChart2 className="w-4 h-4" />
                        Analytics
                    </Button>
                    <Button variant="outline" size="sm" className="w-11 h-11 p-0 rounded-xl bg-secondary/30 border-white/5 hover:border-primary/30 transition-all" asChild>
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
                title={`Analytics: ${video.title}`}
            >
                <VideoAnalytics videoId={video.id} />
            </Modal>
        </Card>
    );
};

export const VideoCardSkeleton = () => {
    return (
        <Card className="flex flex-col border-0 bg-card/40 backdrop-blur-xl h-full relative overflow-hidden rounded-[2rem] ring-1 ring-white/10 shadow-xl">
            <Skeleton className="aspect-video rounded-none bg-secondary/30" />
            <div className="p-6 flex flex-col flex-1 gap-5">
                <div className="space-y-3">
                    <Skeleton className="h-7 w-3/4 rounded-lg" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-full rounded-md" />
                        <Skeleton className="h-4 w-5/6 rounded-md" />
                    </div>
                </div>
                <div className="mt-auto">
                    <Skeleton className="h-6 w-24 rounded-lg" />
                </div>
                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                    <Skeleton className="flex-1 h-11 rounded-xl" />
                    <Skeleton className="w-11 h-11 rounded-xl" />
                </div>
            </div>
        </Card>
    );
};
