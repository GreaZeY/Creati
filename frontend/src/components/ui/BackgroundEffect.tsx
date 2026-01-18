import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '@/context/UIContext';

export function BackgroundEffect() {
    const { pathname } = useLocation();
    const { isInputFocused } = useUI();

    if (pathname === '/') return <LivingGradientMesh />;
    if (['/login', '/register'].includes(pathname)) return <DepthFog isFocused={isInputFocused} />;
    return <div className="fixed inset-0 bg-background z-[-1]" />;
}

function LivingGradientMesh() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const scrollRef = useRef(0);

    useEffect(() => {
        const handleScroll = () => {
            scrollRef.current = window.scrollY;
        };
        window.addEventListener('scroll', handleScroll);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;

        const handleResize = () => {
            const dpr = window.devicePixelRatio || 1;
            width = window.innerWidth;
            height = window.innerHeight;

            // Fix: Scale canvas for High DPI displays to prevent pixelation
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);
        };
        window.addEventListener('resize', handleResize);
        handleResize();

        const handleMouseMove = (e: MouseEvent) => {
            // Parallax target (normalized -1 to 1)
            mouseRef.current = {
                x: (e.clientX / width) * 2 - 1,
                y: (e.clientY / height) * 2 - 1
            };
        };
        window.addEventListener('mousemove', handleMouseMove);

        // Nodes for the mesh
        const nodes = [
            { x: width * 0.2, y: height * 0.3, vx: 0.5, vy: 0.2, r: 600, color: 'rgba(106, 227, 180, 0.08)' }, // #6AE3B4 Mint
            { x: width * 0.8, y: height * 0.7, vx: -0.3, vy: -0.2, r: 500, color: 'rgba(45, 212, 191, 0.08)' }, // #2DD4BF Teal
            { x: width * 0.5, y: height * 0.5, vx: 0.2, vy: 0.4, r: 700, color: 'rgba(59, 130, 246, 0.05)' },  // #3B82F6 Blue
        ];

        let animationFrameId: number;
        let time = 0;

        const animate = () => {
            // Scroll increases speed and contrast (via opacity logic potentially)
            const scrollFactor = 1 + (scrollRef.current / (height * 2)); // 1.0 -> 1.5x speed
            time += 0.005 * scrollFactor;

            ctx.clearRect(0, 0, width, height);

            // Parallax influence (smooth lerp could be added, here distinct nudge)
            const px = mouseRef.current.x * 20; // 20px max movement
            const py = mouseRef.current.y * 20;

            nodes.forEach((node, i) => {
                // Organic movement with sine waves
                const floatX = Math.sin(time + i) * 100;
                const floatY = Math.cos(time + i * 1.5) * 80;

                const x = node.x + floatX + px * (i + 1); // Differing parallax depth
                const y = node.y + floatY + py * (i + 1);

                const gradient = ctx.createRadialGradient(x, y, 0, x, y, node.r);
                gradient.addColorStop(0, node.color);
                gradient.addColorStop(1, 'rgba(0,0,0,0)');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, node.r, 0, Math.PI * 2);
                ctx.fill();
            });

            // Noise texture is handled by CSS overlay now

            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('scroll', handleScroll);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-background transition-colors duration-700">
            {/* Darken slightly on scroll could go here via overlay opacity */}
            <div className="absolute inset-0 bg-background/0 transition-colors" style={{ backgroundColor: `rgba(14,17,22, ${Math.min(scrollRef.current / 5000, 0.3)})` }} />

            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-100" style={{ width: '100%', height: '100%' }} />
            {/* Cinematic Noise Overlay CSS */}
            <div className="absolute inset-0 bg-noise opacity-[0.03] pointer-events-none mix-blend-overlay" />
        </div>
    );
}

function DepthFog({ isFocused }: { isFocused: boolean }) {
    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-background transition-all duration-700">
            {/* Focus Bloom Overlay */}
            <AnimatePresence>
                {isFocused && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 z-0 flex items-center justify-center bg-black/40"
                    >
                        {/* Radial Glow behind form */}
                        <div className="w-[600px] h-[600px] bg-primary/10 rounded-full blur-[100px] absolute" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Base Noise layer - High Fidelity */}
            <div className="absolute inset-0 bg-noise opacity-[0.05] pointer-events-none mix-blend-overlay" />

            {/* Fog Layer - Hardware Accelerated */}
            <motion.div
                className="absolute top-[-20%] left-[-20%] w-[80vw] h-[80vw] bg-accent/5 rounded-full blur-[120px] will-change-transform"
                animate={{
                    x: [0, 50, 0],
                    y: [0, 30, 0],
                    scale: [1, 1.05, 1],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-primary/5 rounded-full blur-[100px] will-change-transform"
                animate={{
                    x: [0, -40, 0],
                    y: [0, -20, 0],
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            />

            {/* Light Threads Removed as per feedback (floating lines issue) */}

            {/* Particles - Floating Specks */}
            {[...Array(20)].map((_, i) => (
                <motion.div
                    key={`particle-${i}`}
                    className="absolute w-1 h-1 bg-white/20 rounded-full"
                    style={{
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                    }}
                    animate={{
                        y: [0, -20, 0],
                        opacity: [0, 0.6, 0],
                    }}
                    transition={{
                        duration: 3 + Math.random() * 5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: Math.random() * 2,
                    }}
                />
            ))}
        </div>
    );
}
