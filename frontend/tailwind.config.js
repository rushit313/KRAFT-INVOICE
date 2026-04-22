/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        kraft: {
          bg: '#0f0f11',
          surface: '#1a1a1e',
          surface2: '#222228',
          accent: '#c8a96e',
          green: '#4caf7d',
          red: '#e05c5c',
          blue: '#5b9cf6',
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      }
    }
  },
  plugins: [require('@tailwindcss/forms')]
}
