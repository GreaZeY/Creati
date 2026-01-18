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
    glow = false,
    className = '',
    ...props
}) => {
    const baseStyles = 'bg-dark-card dark:bg-dark-card light:bg-light-card rounded-xl p-6 border border-gray-800 dark:border-gray-800 light:border-gray-200';
    const glowStyles = glow ? 'shadow-lg shadow-primary/20' : '';

    return (
        <motion.div
            className={`${baseStyles} ${glowStyles} ${className}`}
            whileHover={hover ? { scale: 1.02, y: -6 } : {}}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            {...props}
        >
            {children}
        </motion.div>
    );
};
