import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from './StatusBadge';
import { Calendar, ExternalLink, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { VideoAnalytics } from './VideoAnalytics';

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
        <Card className="flex flex-col overflow-hidden group">
            <div className="aspect-video bg-secondary/50 relative overflow-hidden">
                {/* Thumbnail placeholder */}
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20">
                    <span className="text-4xl font-bold italic tracking-tighter opacity-10 uppercase">Creati</span>
                </div>
                <div className="absolute top-3 right-3">
                    <StatusBadge status={video.jobStatus} />
                </div>
            </div>

            <div className="p-5 flex flex-col flex-1 gap-4">
                <div className="space-y-1">
                    <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                        {video.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                        {video.description || 'No description provided.'}
                    </p>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {date}
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-9 gap-2"
                        onClick={() => setIsAnalyticsOpen(true)}
                        disabled={video.jobStatus !== 'completed'}
                    >
                        <BarChart2 className="w-4 h-4" />
                        Analytics
                    </Button>
                    <Button variant="outline" size="sm" className="w-9 h-9 p-0" asChild>
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
