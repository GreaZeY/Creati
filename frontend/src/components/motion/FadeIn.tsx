import React from 'react';
import { motion } from 'framer-motion';
import { fadeIn } from '@/lib/animations';

interface FadeInProps {
    children: React.ReactNode;
    delay?: number;
    className?: string;
}

/**
 * Reusable FadeIn motion component
 * Wraps children with fade animation
 */
export const FadeIn: React.FC<FadeInProps> = ({ children, delay = 0, className = '' }) => {
    return (
        <motion.div
            className={className}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            custom={delay}
        >
            {children}
        </motion.div>
    );
};
