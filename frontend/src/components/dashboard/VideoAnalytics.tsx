import { useQuery } from '@tanstack/react-query';
import { videosAPI } from '@/lib/api';
import { Loader2, TrendingUp, ThumbsUp, MessageSquare, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';

interface VideoAnalyticsProps {
    videoId: number;
}

export const VideoAnalytics = ({ videoId }: VideoAnalyticsProps) => {
    const { data: analytics, isLoading } = useQuery({
        queryKey: ['video-analytics', videoId],
        queryFn: async () => {
            const resp = await videosAPI.getAnalytics(videoId.toString());
            return resp.data.data;
        },
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Fetching platform metrics...</p>
            </div>
        );
    }

    const current = analytics?.current || { views: 0, likes: 0, comments: 0 };
    const history = analytics?.history || [];

    // Simple Bar Chart Calculation
    const maxViews = Math.max(...history.map((h: any) => h.views), 1);

    return (
        <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 bg-secondary/30 flex flex-col items-center text-center">
                    <TrendingUp className="w-5 h-5 text-primary mb-2" />
                    <span className="text-2xl font-bold">{current.views.toLocaleString()}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Views</span>
                </Card>
                <Card className="p-4 bg-secondary/30 flex flex-col items-center text-center">
                    <ThumbsUp className="w-5 h-5 text-primary mb-2" />
                    <span className="text-2xl font-bold">{current.likes.toLocaleString()}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Likes</span>
                </Card>
                <Card className="p-4 bg-secondary/30 flex flex-col items-center text-center">
                    <MessageSquare className="w-5 h-5 text-primary mb-2" />
                    <span className="text-2xl font-bold">{current.comments.toLocaleString()}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Comments</span>
                </Card>
            </div>

            {/* Simple Historical Chart */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Historical Growth
                </div>
                <div className="h-32 flex items-end gap-1 px-2 border-b border-l border-border/50">
                    {history.length > 0 ? history.map((snapshot: any, i: number) => (
                        <motion.div
                            key={i}
                            initial={{ height: 0 }}
                            animate={{ height: `${(snapshot.views / maxViews) * 100}%` }}
                            transition={{ delay: i * 0.05, duration: 0.5 }}
                            className="flex-1 bg-primary/40 hover:bg-primary transition-colors rounded-t-sm"
                            title={`${new Date(snapshot.fetchedAt).toLocaleDateString()}: ${snapshot.views} views`}
                        />
                    )) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground italic">
                            Accumulating data points...
                        </div>
                    )}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>First fetch</span>
                    <span>Recent</span>
                </div>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-[11px] text-muted-foreground italic">
                Data is automatically refreshed from platforms every hour when viewed.
            </div>
        </div>
    );
};
