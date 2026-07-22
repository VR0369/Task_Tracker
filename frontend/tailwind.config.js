/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
        sev: {
          critical: '#ef4444',
          high: '#f59e0b',
          low: '#22c55e',
        },
      },
      backgroundImage: {
        'grad-brand': 'linear-gradient(135deg,rgb(var(--brand-500)) 0%,rgb(var(--brand-alt)) 100%)',
        'grad-red': 'linear-gradient(135deg,#ff6a6a 0%,#e11d48 100%)',
        'grad-yellow': 'linear-gradient(135deg,#ffd36e 0%,#f59e0b 100%)',
        'grad-blue': 'linear-gradient(135deg,#7fd6ff 0%,#4f8cff 100%)',
        'grad-green': 'linear-gradient(135deg,#8ff0a4 0%,#22c55e 100%)',
        // Softer variants: used behind translucent cards so their borders/icons stay legible.
        'grad-red-soft': 'linear-gradient(135deg,#ffe1e1 0%,#ffc2ce 100%)',
        'grad-yellow-soft': 'linear-gradient(135deg,#fff2d3 0%,#ffe0a3 100%)',
        'grad-blue-soft': 'linear-gradient(135deg,#e2f4ff 0%,#cfe0ff 100%)',
        'grad-red-dim': 'linear-gradient(135deg,#4a2027 0%,#3a1620 100%)',
        'grad-yellow-dim': 'linear-gradient(135deg,#43341a 0%,#382713 100%)',
        'grad-blue-dim': 'linear-gradient(135deg,#1d3550 0%,#182a44 100%)',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(31,38,135,0.15)',
        'glass-lg': '0 12px 48px rgba(31,38,135,0.22)',
      },
      borderRadius: {
        xl2: '1rem',
        '2xl': '1.25rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-red': {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.35)' },
          '50%': { boxShadow: '0 0 0 6px rgba(239,68,68,0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease forwards',
        'pulse-red': 'pulse-red 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
