export const themes = {
    light: {
        colors: {
            background: '#ffffff',
            foreground: '#0f172a',
            primary: '#08cea8',
            secondary: '#f1f5f9', // Slate-100
            accent: '#f1f5f9',
            muted: '#64748b',
            border: '#e2e8f0',
        },
    },
    dark: {
        colors: {
            background: '#121212',
            foreground: '#f8fafc',
            primary: '#08cea8',
            secondary: '#1e293b', // Slate-800
            accent: '#1e293b',
            muted: '#94a3b8',
            border: '#1e293b',
        },
    },
} as const;

export const activeTheme = themes.dark; // Default
