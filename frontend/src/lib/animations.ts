import { Variants } from 'framer-motion';
import { ANIMATION } from './constants';

// Reusable animation variants following DRY principle

/**
 * Fade in animation
 * Usage: <motion.div variants={fadeIn} initial="hidden" animate="visible" />
 */
export const fadeIn: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            duration: ANIMATION.duration.normal / 1000,
            ease: ANIMATION.easing,
        },
    },
};

/**
 * Slide in from left
 */
export const slideInLeft: Variants = {
    hidden: { x: -40, opacity: 0 },
    visible: {
        x: 0,
        opacity: 1,
        transition: {
            duration: ANIMATION.duration.normal / 1000,
            ease: ANIMATION.easing,
        },
    },
};

/**
 * Slide in from bottom with lift
 */
export const slideInBottom: Variants = {
    hidden: { y: 40, opacity: 0 },
    visible: {
        x: 0,
        opacity: 1,
        transition: {
            duration: ANIMATION.duration.slow / 1000,
            ease: ANIMATION.easing,
        },
    },
};

/**
 * Pop animation (scale)
 */
export const pop: Variants = {
    initial: { scale: 1 },
    tap: { scale: 0.9 },
    hover: { scale: 1.05 },
};

/**
 * Shake animation (for errors)
 */
export const shake = {
    x: [-6, 6, -6, 6, 0],
    transition: {
        duration: ANIMATION.duration.slow / 1000,
    },
};

/**
 * Stagger children animation
 * Usage: <motion.div variants={staggerContainer} initial="hidden" animate="visible">
 */
export const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

/**
 * Stagger child item
 */
export const staggerItem: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: {
            duration: ANIMATION.duration.normal / 1000,
            ease: ANIMATION.easing,
        },
    },
};

/**
 * Rotate animation (for success icons)
 */
export const rotate360: Variants = {
    initial: { rotate: 0 },
    animate: {
        rotate: 360,
        transition: {
            duration: ANIMATION.duration.slow / 1000,
            ease: ANIMATION.easing,
        },
    },
};

/**
 * Scale hover (for cards and buttons)
 */
export const scaleHover = {
    hover: {
        scale: 1.02,
        transition: {
            duration: ANIMATION.duration.fast / 1000,
        },
    },
};
