import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformsAPI } from '@/lib/api';
import { Youtube, Instagram, Facebook, Linkedin, Twitter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { staggerContainer, staggerItem } from '@/lib/animations';
import { triggerConfetti } from '@/lib/confetti';
import { PLATFORMS } from '@/lib/constants';

interface PlatformStatus {
    id: string;
    name: string;
    status: 'connected' | 'disconnected';
}

export const ConnectPlatforms = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

    // Check for OAuth callback success
    useEffect(() => {
        const status = searchParams.get('status');
        const platform = searchParams.get('platform');

        if (status === 'success' && platform) {
            // Trigger success confetti
            triggerConfetti('connectionSuccess');

            // Refresh platform list
            queryClient.invalidateQueries({ queryKey: ['platforms'] });

            // Clear URL params
            window.history.replaceState({}, '', '/connect');
        }
    }, [searchParams, queryClient]);

    // Fetch platforms and their connection status
    const { data: platformStats = {}, isLoading } = useQuery({
        queryKey: ['platforms'],
        queryFn: async () => {
            const response = await platformsAPI.list();
            return response.data as Record<string, boolean>;
        },
    });

    // Connect platform mutation
    const connectMutation = useMutation({
        mutationFn: async (platformId: string) => {
            const response = await platformsAPI.connect(platformId);
            return response.data.data.authUrl;
        },
        onSuccess: (authUrl: string) => {
            // Redirect to OAuth page
            if (authUrl) window.location.assign(authUrl);
        },
        onError: (error: Error) => {
            // Toast handled by global event bus now
            // alert('Connection failed: ' + error.message);
            setConnectingPlatform(null);
        },
    });

    const handleConnect = (platformId: string) => {
        setConnectingPlatform(platformId);
        connectMutation.mutate(platformId);
    };


    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
            <motion.div
                className="text-center mb-12 max-w-2xl"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                    Connect Your Platforms
                </h1>
                <p className="text-xl text-gray-400">
                    Link your accounts to start uploading content everywhere
                </p>
            </motion.div>

            {isLoading ? (
                <div className="text-gray-400">Loading platforms...</div>
            ) : (
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                >
                    {Object.values(PLATFORMS).map((platform) => {
                        const isConnected = platformStats[platform.id] || false;
                        const isConnecting = connectingPlatform === platform.id;

                        const Icon =
                            platform.id === 'youtube' ? Youtube :
                                platform.id === 'instagram' ? Instagram :
                                    platform.id === 'facebook' ? Facebook :
                                        platform.id === 'linkedin' ? Linkedin : Twitter;

                        return (
                            <motion.div key={platform.id} variants={staggerItem}>
                                <Card
                                    hover={platform.enabled && !isConnected}
                                    className={cn(
                                        "relative h-full flex flex-col",
                                        !platform.enabled && "opacity-50"
                                    )}
                                >
                                    {/* Platform Icon/Name */}
                                    <div className="flex flex-col items-center mb-6">
                                        <div className={cn(
                                            "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors",
                                            isConnected ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                                        )}>
                                            <Icon size={32} />
                                        </div>
                                        <h3 className="text-xl font-semibold mb-1">{platform.name}</h3>
                                        <span className="text-sm text-muted-foreground">
                                            {isConnected ? 'Connected' : platform.enabled ? 'Not connected' : 'Coming soon'}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="mt-auto">
                                        {isConnected ? (
                                            <div className="flex items-center justify-center gap-2 text-primary bg-primary/5 py-2 rounded-lg text-sm font-medium">
                                                <div className="w-2 h-2 rounded-full bg-primary" />
                                                Active
                                            </div>
                                        ) : (
                                            <Button
                                                variant={platform.enabled ? "default" : "secondary"}
                                                onClick={() => handleConnect(platform.id)}
                                                disabled={isConnecting || !platform.enabled}
                                                className="w-full"
                                            >
                                                {isConnecting ? 'Connecting...' : 'Connect'}
                                            </Button>
                                        )}
                                    </div>
                                </Card>
                            </motion.div>
                        );
                    })}
                </motion.div>
            )}

        </div>
    );
};
