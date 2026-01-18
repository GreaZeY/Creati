import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Link2, LayoutDashboard, UploadCloud } from 'lucide-react';
import { motion } from 'framer-motion';

export const Dashboard = () => {
    const navigate = useNavigate();

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
                            variant="default" // Using default as it's a primary action on this card
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

                {/* Placeholder Stats */}
                <Card className="p-6 border-border bg-card hover:bg-card/80 transition-colors relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-4 relative z-10">
                        <div className="p-3 bg-accent/10 text-accent rounded-xl">
                            <LayoutDashboard className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Total Views</h3>
                            <p className="text-sm text-muted-foreground">Last 30 days</p>
                        </div>
                    </div>
                    <div className="mb-2 relative z-10">
                        <span className="text-3xl font-bold">0</span>
                    </div>
                    {/* Decorative subtle graph line */}
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-accent/5 to-transparent z-0" />
                </Card>
            </div>

            <div className="mt-8">
                <h2 className="text-xl font-semibold mb-4">Recent Uploads</h2>
                <div className="p-8 border border-dashed border-border rounded-xl text-center">
                    <p className="text-muted-foreground">No videos uploaded yet.</p>
                </div>
            </div>
        </DashboardLayout>
    );
};
