import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#60a5fa',
        'primary-dark': '#3b82f6',
        secondary: '#94a3b8',
        success: '#34d399',
        warning: '#fbbf24',
        danger: '#f87171',
        border: '#253045',
      },
    },
  },
}

export default config
