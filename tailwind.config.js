/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "index.html",
    "blog.html",
    "**/*.html",
    "src/**/*.{html,js,ts,jsx,tsx}",
    "*.{html,js}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace']
      },
      colors: {
        bg: {
          DEFAULT: '#0a0a0b',
          soft: '#141416',
          card: '#1a1a1c',
          glow: '#202022',
        },
        accent: {
          DEFAULT: 'var(--accent-color, #4a90e2)',
          light: 'var(--accent-light, #6ba3e8)',
          dark: 'var(--accent-dark, #357abd)',
          glow: 'var(--accent-glow, rgba(74, 144, 226, 0.3))',
        },
        secondary: {
          blue: 'var(--accent-color)',
          green: 'var(--accent-light)',
          purple: 'var(--accent-dark)',
          orange: 'var(--accent-glow)',
        },
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 3s infinite',
        'spin-slow': 'spin 8s linear infinite',
        'fade-up': 'fadeUp 0.8s ease-out forwards',
        'slide-in': 'slideIn 1s ease-out forwards',
        'typing': 'typing 3.5s steps(30, end), blink-caret .75s step-end infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' }
        },
        glow: {
          'from': { boxShadow: '0 0 20px var(--accent-glow)' },
          'to': { boxShadow: '0 0 30px var(--accent-glow)' }
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        typing: {
          'from': { width: '0' },
          'to': { width: '100%' }
        },
        'blink-caret': {
          'from, to': { borderColor: 'transparent' },
          '50%': { borderColor: 'var(--accent-color)' }
        }
      },
      boxShadow: {
        'glow': '0 0 30px var(--accent-glow)',
        'inner-glow': 'inset 0 0 15px var(--accent-glow)',
      },
      backgroundImage: {
        'grid': 'linear-gradient(var(--accent-glow) 1px, transparent 1px), linear-gradient(90deg, var(--accent-glow) 1px, transparent 1px)',
      }
    },
  },
  plugins: [],
}
