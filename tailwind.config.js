/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          500: '#3b82f6',
          600: '#2563eb',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          400: '#9ca3af',
          500: '#6b7280',
        },
        red: {
          100: '#fee2e2',
          500: '#ef4444',
          700: '#b91c1c',
        },
        green: {
          500: '#22c55e',
        },
        yellow: {
          500: '#eab308',
        },
        orange: {
          500: '#f97316',
        },
        purple: {
          500: '#a855f7',
        },
      },
    },
  },
  plugins: [],
}