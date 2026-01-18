import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#08cea8',
        dark: {
          bg: '#121212',
          card: '#1a1a1a',
        },
        light: {
          bg: '#ffffff',
          card: '#f5f5f5',
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'border-pulse': 'border-pulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(8, 206, 168, 0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(8, 206, 168, 0.8)' },
        },
        'border-pulse': {
          '0%, 100%': { borderColor: 'rgba(8, 206, 168, 0.3)' },
          '50%': { borderColor: 'rgba(8, 206, 168, 0.8)' },
        },
      },
      transitionDuration: {
        '200': '200ms',
        '400': '400ms',
      },
      transitionTimingFunction: {
        'out': 'cubic-bezier(0, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
