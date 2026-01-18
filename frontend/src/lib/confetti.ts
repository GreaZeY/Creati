import confetti from 'canvas-confetti';
import { CONFETTI } from '@/lib/constants';

export type ConfettiTrigger = 'connectionSuccess' | 'uploadSuccess' | 'milestone';

/**
 * Centralized confetti utility following DRY principle
 * Settings configured in constants.ts
 */
export const triggerConfetti = (trigger: ConfettiTrigger) => {
    const config = CONFETTI[trigger];

    confetti({
        ...config,
        colors: ['#08cea8', '#00ffcc', '#00d4aa', '#04b394'],
    });
};

/**
 * Check if milestone confetti should trigger
 * Uses localStorage to prevent repeat celebrations
 */
export const shouldTriggerMilestone = (milestone: string): boolean => {
    const key = `milestone_${milestone}`;
    const triggered = localStorage.getItem(key);

    if (!triggered) {
        localStorage.setItem(key, 'true');
        return true;
    }

    return false;
};
