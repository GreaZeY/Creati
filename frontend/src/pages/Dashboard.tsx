import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Link2, LayoutDashboard, UploadCloud, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { videosAPI } from '@/lib/api';
import { VideoCard } from '@/components/dashboard/VideoCard';

export const Dashboard = () => {
    const navigate = useNavigate();

    const { data, isLoading } = useQuery({
        queryKey: ['videos'],
        queryFn: async () => {
            const resp = await videosAPI.list();
            return resp.data.data;
        },
        // Poll every 5 seconds if there are videos in 'processing' or 'pending' state
        refetchInterval: (query) => {
            const videos = query.state.data as any[];
            if (videos?.some(v => v.jobStatus === 'processing' || v.jobStatus === 'pending')) {
                return 5000;
            }
            return false;
        }
    });

    const videos = data || [];

    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
                <p className="text-muted-foreground">Manage your uploads and view performance.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Platforms Quick Access */}
                <Card className="p-6 border-border bg-card hover:bg-card/80 transition-colors">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-primary/10 text-primary rounded-xl">
                            <Link2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Platforms</h3>
                            <p className="text-sm text-muted-foreground">Manage connections</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Connect YouTube, Instagram, and more to auto-publish content.
                        </p>
                        <Button
                            variant="default"
                            className="w-full"
                            onClick={() => navigate('/connect')}
                        >
                            Manage Connections
                        </Button>
                    </div>
                </Card>

                {/* Upload Quick Access */}
                <Card className="p-6 border-border bg-card hover:bg-card/80 transition-colors">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-secondary text-foreground rounded-xl">
                            <UploadCloud className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Upload</h3>
                            <p className="text-sm text-muted-foreground">New content</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Upload videos to publish across all connected platforms.
                        </p>
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={() => navigate('/upload')}
                        >
                            Start Upload
                        </Button>
                    </div>
                </Card>

                {/* Stats Card */}
                <Card className="p-6 border-border bg-card hover:bg-card/80 transition-colors relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-4 relative z-10">
                        <div className="p-3 bg-accent/10 text-accent rounded-xl">
                            <LayoutDashboard className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Total Uploads</h3>
                            <p className="text-sm text-muted-foreground">Lifetime</p>
                        </div>
                    </div>
                    <div className="mb-2 relative z-10">
                        <span className="text-3xl font-bold">{videos.length}</span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-accent/5 to-transparent z-0" />
                </Card>
            </div>

            <div className="mt-12">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Recent Uploads</h2>
                    <Link2 className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-primary transition-colors" />
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-muted-foreground">Loading your content...</p>
                    </div>
                ) : videos.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {videos.map((video: any) => (
                            <VideoCard key={video.id} video={video} />
                        ))}
                    </div>
                ) : (
                    <Card className="p-12 border-dashed flex flex-col items-center text-center bg-card/50">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <UploadCloud className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium mb-1">No videos yet</h3>
                        <p className="text-muted-foreground mb-6 max-w-xs">
                            Start by uploading your first video to see it here.
                        </p>
                        <Button variant="outline" onClick={() => navigate('/upload')}>
                            Upload Video
                        </Button>
                    </Card>
                )}
            </div>
        </DashboardLayout>
    );
};

