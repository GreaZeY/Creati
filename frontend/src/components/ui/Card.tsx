import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
    children: React.ReactNode;
    hover?: boolean;
    glow?: boolean;
}

/**
 * Card component with optional hover animation
 * Follows dark/light theme system
 */
export const Card: React.FC<CardProps> = ({
    children,
    hover = false,
    glow = false, // Deprecated but kept for interface compatibility
    className = '',
    ...props
}) => {
    return (
        <motion.div
            whileHover={hover ? { y: -4 } : {}}
            className={`
                relative bg-dark-card rounded-2xl border border-white/5 
                backdrop-blur-sm p-6 overflow-hidden
                ${className}
            `}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            {...props}
        >
            {children}
        </motion.div>
    );
};
