import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#111E35',
          50:  '#1B2A47',
          100: '#162240',
          200: '#111E35',
          300: '#0C1628',
        },
        brand: {
          400: '#7AAAFF',
          500: '#5090F0',
          600: '#3B6BE8',
          700: '#2B5BC8',
        },
        // Keep violet alias pointing to brand for backward compat with any Tailwind classes
        violet: {
          400: '#7AAAFF',
          500: '#5090F0',
          600: '#3B6BE8',
          700: '#2B5BC8',
        },
        indigo: {
          400: '#93C5FD',
          500: '#3B82F6',
          600: '#2563EB',
        },
        glass: {
          DEFAULT: 'rgba(255,255,255,0.05)',
          border:  'rgba(255,255,255,0.08)',
          hover:   'rgba(255,255,255,0.08)',
        },
      },
      backgroundColor: {
        app: '#0C1628',
      },
      backgroundImage: {
        'gradient-radial':     'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand':      'linear-gradient(135deg, #3B6BE8 0%, #2563EB 100%)',
        'gradient-brand-soft': 'linear-gradient(135deg, rgba(59,107,232,0.15) 0%, rgba(37,99,235,0.15) 100%)',
      },
      boxShadow: {
        card:      '0 4px 24px rgba(0,0,0,0.4)',
        glow:      '0 0 24px rgba(59,107,232,0.3)',
        'glow-sm': '0 0 12px rgba(59,107,232,0.2)',
      },
      keyframes: {
        'slide-up': {
          from: { transform: 'translateY(16px)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(16px)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'slide-up':       'slide-up 0.25s ease-out',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'fade-in':        'fade-in 0.2s ease-out',
        shimmer:          'shimmer 1.8s infinite linear',
        float:            'float 3s ease-in-out infinite',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}

export default config
