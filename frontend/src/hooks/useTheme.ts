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
        // Disable transitions
        const css = document.createElement('style');
        css.type = 'text/css';
        css.appendChild(document.createTextNode(`* {
            -webkit-transition: none !important;
            -moz-transition: none !important;
            -o-transition: none !important;
            -ms-transition: none !important;
            transition: none !important;
        }`));
        document.head.appendChild(css);

        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

        // Force repaint
        const _ = window.getComputedStyle(css).opacity;

        // Re-enable transitions
        setTimeout(() => {
            document.head.removeChild(css);
        }, 1);
    };

    return { theme, toggleTheme };
};
