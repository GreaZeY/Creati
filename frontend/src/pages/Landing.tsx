import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { slideInLeft, staggerContainer, staggerItem } from '@/lib/animations';

export const Landing = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4">
            {/* Hero Section */}
            <motion.div
                className="text-center max-w-4xl mb-16"
                variants={slideInLeft}
                initial="hidden"
                animate="visible"
            >
                <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                    Upload Once,
                    <br />
                    Share Everywhere
                </h1>
                <p className="text-xl text-gray-400 mb-8">
                    The creator tool that actually ships value. Upload to YouTube (and more platforms soon) from a single, beautiful interface.
                </p>

                <Button size="lg" className="shadow-lg shadow-primary/30" onClick={() => navigate('/register')}>
                    Get Started →
                </Button>
            </motion.div>

            {/* Feature Cards */}
            <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
            >
                <motion.div variants={staggerItem}>
                    <Card hover glow>
                        <div className="text-4xl mb-4">🎬</div>
                        <h3 className="text-xl font-semibold mb-2">Unified Upload</h3>
                        <p className="text-gray-400">
                            Upload your content once and distribute it across multiple platforms effortlessly.
                        </p>
                    </Card>
                </motion.div>

                <motion.div variants={staggerItem}>
                    <Card hover glow>
                        <div className="text-4xl mb-4">📊</div>
                        <h3 className="text-xl font-semibold mb-2">Track Status</h3>
                        <p className="text-gray-400">
                            Monitor upload progress and status for all platforms in one dashboard.
                        </p>
                    </Card>
                </motion.div>

                <motion.div variants={staggerItem}>
                    <Card hover glow>
                        <div className="text-4xl mb-4">✨</div>
                        <h3 className="text-xl font-semibold mb-2">Clean UX</h3>
                        <p className="text-gray-400">
                            Beautiful, Gen Z-inspired design with delightful animations and zero chaos.
                        </p>
                    </Card>
                </motion.div>
            </motion.div>

            {/* Footer */}
            <div className="mt-20 text-gray-500 text-sm">
                Currently supporting YouTube · More platforms coming soon
            </div>
        </div>
    );
};
