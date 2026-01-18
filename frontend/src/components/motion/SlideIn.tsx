import React from 'react';
import { motion } from 'framer-motion';
import { slideInLeft } from '@/lib/animations';

interface SlideInProps {
    children: React.ReactNode;
    delay?: number;
    className?: string;
}

/**
 * Reusable SlideIn motion component
 * Wraps children with slide from left animation
 */
export const SlideIn: React.FC<SlideInProps> = ({ children, delay = 0, className = '' }) => {
    return (
        <motion.div
            className={className}
            variants={slideInLeft}
            initial="hidden"
            animate="visible"
            custom={delay}
        >
            {children}
        </motion.div>
    );
};
