/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

  /**
   * The immutable legacy modules inject markup via innerHTML at runtime, so
   * Tailwind's scanner cannot see those class names in source. Everything the
   * legacy modules emit is safelisted here. See DOM_CONTRACT.md.
   */
  safelist: [
    'hidden',
    'flex',
    'disabled-link',
    'disabled-div',
    'card-base',
    'btn-primary',
    'text-3xl',
    'text-4xl',
    'text-5xl',
    'text-8xl',
    'font-black',
    'animate-pulse',
    'text-emerald-400',
    'text-red-400',
    'text-yellow-400',
    'border-emerald-500',
    'border-yellow-400',
    'text-gray-300',
    'text-gray-400',
    'text-gray-500',
    'text-gray-700',
    'border-gray-600',
    'min-w-[300px]',
    'tracking-widest',
  ],

  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0f',
          secondary: '#0f0f1a',
          card: '#13131f',
          elevated: '#1a1a2e',
        },
        border: {
          DEFAULT: '#1e1e3a',
          accent: '#2d2d5e',
        },
        accent: {
          primary: '#6c63ff',
          cyan: '#00d4ff',
          green: '#00ff88',
          red: '#ff4444',
          amber: '#ffaa00',
        },
        content: {
          primary: '#f0f0ff',
          secondary: '#8888bb',
          muted: '#4a4a7a',
        },
      },

      fontFamily: {
        heading: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },

      boxShadow: {
        'glow-violet': '0 0 20px rgba(108,99,255,0.4)',
        'glow-cyan': '0 0 15px rgba(0,212,255,0.3)',
        'glow-green': '0 0 12px rgba(0,255,136,0.35)',
        'glow-red': '0 0 12px rgba(255,68,68,0.35)',
        'glow-amber': '0 0 12px rgba(255,170,0,0.35)',
        'glow-gold': '0 0 32px rgba(255,196,0,0.45)',
        card: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.7)',
      },

      backgroundImage: {
        'gradient-hero': 'linear-gradient(135deg, #6c63ff 0%, #00d4ff 100%)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },

      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },

      transitionDuration: {
        hover: '150ms',
        panel: '250ms',
        page: '400ms',
      },

      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 12px rgba(108,99,255,0.25)' },
          '50%': { boxShadow: '0 0 28px rgba(108,99,255,0.55)' },
        },
        'glow-pulse-cyan': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0,212,255,0.2)' },
          '50%': { boxShadow: '0 0 26px rgba(0,212,255,0.5)' },
        },
        'status-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(0.88)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'ball-x': {
          '0%, 100%': { left: '4%' },
          '50%': { left: '92%' },
        },
        'ball-y': {
          '0%, 100%': { top: '18%' },
          '50%': { top: '76%' },
        },
      },

      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'glow-pulse-cyan': 'glow-pulse-cyan 2s ease-in-out infinite',
        'status-pulse': 'status-pulse 2s ease-in-out infinite',
        'fade-up': 'fade-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        'ball-x': 'ball-x 4.5s linear infinite',
        'ball-y': 'ball-y 3.1s linear infinite',
      },
    },
  },

  plugins: [],
};
