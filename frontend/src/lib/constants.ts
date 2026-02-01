// Theme colors
export const COLORS = {
    primary: '#08cea8',
    dark: {
        bg: '#121212',
        card: '#1a1a1a',
    },
    light: {
        bg: '#ffffff',
        card: '#f5f5f5',
    },
    error: '#f44336',
    warning: '#ff9800',
    info: '#03a9f4',
} as const;

// Animation durations (ms)
export const ANIMATION = {
    duration: {
        fast: 200,
        normal: 300,
        slow: 400,
    },
    easing: 'cubic-bezier(0, 0, 0.2, 1)', // easeOut
} as const;

// Platform configurations
// Platform configurations
export const PLATFORMS = {
    youtube: {
        id: 'youtube',
        name: 'YouTube',
        color: '#FF0000',
        enabled: true,
        hasEvents: false,
    },
    instagram: {
        id: 'instagram',
        name: 'Instagram',
        color: '#E4405F',
        enabled: true,
        hasEvents: true,
    },
    facebook: {
        id: 'facebook',
        name: 'Facebook',
        color: '#1877F2',
        enabled: true,
        hasEvents: true,
    },
    x: {
        id: 'x',
        name: 'X',
        color: '#000000',
        enabled: true,
        hasEvents: false,
    },
    linkedin: {
        id: 'linkedin',
        name: 'LinkedIn',
        color: '#0A66C2',
        enabled: true,
        hasEvents: false,
    },
    discord: {
        id: 'discord',
        name: 'Discord',
        color: '#5865F2',
        enabled: true,
        hasEvents: false,
    },
    reddit: {
        id: 'reddit',
        name: 'Reddit',
        color: '#FF4500',
        enabled: true,
        hasEvents: false,
    },
} as const;

export type PlatformId = keyof typeof PLATFORMS;

// API endpoints (will be set from env)
// API endpoints (will be set from env)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Confetti settings
export const CONFETTI = {
    connectionSuccess: {
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
    },
    uploadSuccess: {
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
    },
    milestone: {
        particleCount: 200,
        spread: 100,
        origin: { y: 0.5 },
    },
} as const;

// Milestone triggers (stored in localStorage to prevent repeat)
export const MILESTONES = {
    firstUpload: 1,
    fiveUploads: 5,
    hundredViews: 100,
} as const;

// Upload constraints
export const UPLOAD = {
    maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
    acceptedFormats: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    acceptedExtensions: ['.mp4', '.mov', '.avi'],
} as const;
