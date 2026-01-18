import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformsAPI } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { staggerContainer, staggerItem, rotate360 } from '@/lib/animations';
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
    const { data: platforms = [], isLoading } = useQuery({
        queryKey: ['platforms'],
        queryFn: async () => {
            const response = await platformsAPI.list();
            return response.data as PlatformStatus[];
        },
    });

    // Connect platform mutation
    const connectMutation = useMutation({
        mutationFn: async (platformId: string) => {
            const response = await platformsAPI.connect(platformId);
            return response.data.auth_url;
        },
        onSuccess: (authUrl: string) => {
            // Redirect to OAuth page
            window.location.href = authUrl;
        },
        onError: (error: Error) => {
            alert('Connection failed: ' + error.message);
            setConnectingPlatform(null);
        },
    });

    const handleConnect = (platformId: string) => {
        setConnectingPlatform(platformId);
        connectMutation.mutate(platformId);
    };

    const handleContinue = () => {
        const hasConnected = platforms.some((p) => p.status === 'connected');
        if (hasConnected) {
            navigate('/dashboard');
        }
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
                    {Object.values(PLATFORMS).map((platform, index) => {
                        const platformStatus = platforms.find((p) => p.id === platform.id);
                        const isConnected = platformStatus?.status === 'connected';
                        const isConnecting = connectingPlatform === platform.id;

                        return (
                            <motion.div key={platform.id} variants={staggerItem}>
                                <Card
                                    hover={platform.enabled && !isConnected}
                                    glow={isConnected}
                                    className={`relative ${!platform.enabled ? 'opacity-50' : ''}`}
                                >
                                    {/* Platform Icon/Name */}
                                    <div className="text-center mb-4">
                                        <div className="text-6xl mb-3">
                                            {platform.id === 'youtube' && '📺'}
                                            {platform.id === 'instagram' && '📷'}
                                            {platform.id === 'facebook' && '👥'}
                                            {platform.id === 'x' && '🐦'}
                                            {platform.id === 'linkedin' && '💼'}
                                        </div>
                                        <h3 className="text-2xl font-semibold">{platform.name}</h3>
                                    </div>

                                    {/* Status Badge */}
                                    {isConnected && (
                                        <motion.div
                                            className="flex items-center justify-center gap-2 mb-4 text-primary"
                                            variants={rotate360}
                                            initial="initial"
                                            animate="animate"
                                        >
                                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                <path
                                                    fillRule="evenodd"
                                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            <span className="font-medium">Connected</span>
                                        </motion.div>
                                    )}

                                    {/* Connect Button */}
                                    {!platform.enabled ? (
                                        <div className="text-center text-sm text-gray-500">Coming Soon</div>
                                    ) : isConnected ? (
                                        <Button variant="secondary" fullWidth disabled>
                                            Connected
                                        </Button>
                                    ) : (
                                        <Button
                                            fullWidth
                                            onClick={() => handleConnect(platform.id)}
                                            disabled={isConnecting}
                                        >
                                            {isConnecting ? 'Connecting...' : 'Connect'}
                                        </Button>
                                    )}
                                </Card>
                            </motion.div>
                        );
                    })}
                </motion.div>
            )}

            {/* Continue Button */}
            {platforms.some((p) => p.status === 'connected') && (
                <motion.div
                    className="mt-12"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Button size="lg" onClick={handleContinue}>
                        Continue to Dashboard →
                    </Button>
                </motion.div>
            )}

            {/* Skip Option */}
            <div className="mt-6 text-center">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="text-gray-400 hover:text-primary transition-colors"
                >
                    Skip for now
                </button>
            </div>
        </div>
    );
};
