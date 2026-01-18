import { useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

/**
 * Theme hook with localStorage persistence
 * Default: dark mode
 */
export const useTheme = () => {
    const [theme, setTheme] = useState<Theme>(() => {
        const stored = localStorage.getItem('theme');
        return (stored as Theme) || 'dark';
    });

    useEffect(() => {
        // Apply theme to body
        document.body.classList.remove('dark', 'light');
        document.body.classList.add(theme);

        // Persist to localStorage
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    };

    return { theme, toggleTheme };
};
