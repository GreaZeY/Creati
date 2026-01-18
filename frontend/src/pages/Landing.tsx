import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { slideInLeft, staggerContainer, staggerItem } from '@/lib/animations';

export const Landing = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col justify-center px-6 lg:px-20 py-20 max-w-7xl mx-auto">
            {/* Hero Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-32">
                {/* Left: Content */}
                <motion.div
                    className="space-y-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                >
                    <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.1]">
                        Upload Once.<br />
                        <span className="text-muted-foreground">Share Everywhere.</span>
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-lg leading-relaxed">
                        The creator tool that actually ships value. Sync to YouTube today, everything else tomorrow.
                    </p>

                    <div className="flex items-center gap-4">
                        <Button size="lg" onClick={() => navigate('/register')}>
                            Get Started
                        </Button>
                        <Button variant="secondary" size="lg">
                            How it works
                        </Button>
                    </div>
                </motion.div>

                {/* Right: Animated Product Mock */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.7, delay: 0.2 }}
                    className="relative"
                >
                    {/* Abstract Window Mockup */}
                    <div className="relative z-10 bg-card border border-white/5 rounded-2xl shadow-2xl p-6 aspect-[4/3] overflow-hidden flex flex-col">
                        {/* Fake Header */}
                        <div className="flex items-center gap-2 mb-6 border-b border-border/50 pb-4">
                            <div className="w-3 h-3 rounded-full bg-red-500/20" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                            <div className="w-3 h-3 rounded-full bg-green-500/20" />
                        </div>

                        {/* Fake Content: Upload Progress */}
                        <div className="flex-1 flex flex-col justify-center space-y-6">
                            {/* Upload Item 1 */}
                            <motion.div
                                className="bg-background/50 rounded-xl p-4 border border-border flex items-center gap-4"
                                animate={{ y: [0, -4, 0] }}
                                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500">▶</div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-2 w-24 bg-muted rounded-full" />
                                    <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-primary"
                                            animate={{ width: ["0%", "100%"] }}
                                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                                        />
                                    </div>
                                </div>
                                <div className="text-primary text-xs font-mono">100%</div>
                            </motion.div>

                            {/* Floating Success Toast */}
                            <motion.div
                                className="absolute bottom-8 right-8 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium shadow-lg"
                                animate={{ y: [10, 0, 10], opacity: [0, 1, 0] }}
                                transition={{ duration: 4, repeat: Infinity, times: [0, 0.2, 0.8], repeatDelay: 1 }}
                            >
                                ✓ Upload Complete
                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Features Section */}
            <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-8"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
            >
                <motion.div variants={staggerItem}>
                    <Card hover className="h-full">
                        <div className="text-4xl mb-6 p-3 bg-primary/10 w-fit rounded-xl text-primary">🎬</div>
                        <h3 className="text-xl font-semibold mb-3">Unified Upload</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            Upload your content once and distribute it across multiple platforms effortlessly.
                        </p>
                    </Card>
                </motion.div>

                <motion.div variants={staggerItem}>
                    <Card hover className="h-full">
                        <div className="text-4xl mb-6 p-3 bg-blue-500/10 w-fit rounded-xl text-blue-500">📊</div>
                        <h3 className="text-xl font-semibold mb-3">Track Status</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            Monitor upload progress and status for all platforms in one dashboard.
                        </p>
                    </Card>
                </motion.div>

                <motion.div variants={staggerItem}>
                    <Card hover className="h-full">
                        <div className="text-4xl mb-6 p-3 bg-purple-500/10 w-fit rounded-xl text-purple-500">✨</div>
                        <h3 className="text-xl font-semibold mb-3">Clean UX</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            Beautiful, Gen Z-inspired design with delightful animations and zero chaos.
                        </p>
                    </Card>
                </motion.div>
            </motion.div>

            {/* Footer */}
            <div className="mt-32 text-center text-muted-foreground text-sm border-t border-border pt-8">
                Currently supporting YouTube · More platforms coming soon
            </div>
        </div>
    );
};
