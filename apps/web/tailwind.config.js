/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', "Liberation Mono", "Courier New", 'monospace'],
      },
      colors: {
        background: '#0a0a0a', // near black
        surface: '#171717',    // dark charcoal
        border: '#262626',     // subtle borders
        text: {
          main: '#f5f5f5',     // warm white
          muted: '#a3a3a3',
        },
        primary: {
          DEFAULT: '#f59e0b',  // razorpay amber/gold
          hover: '#fbbf24',
          muted: '#f59e0b20',
        }
      }
    },
  },
  plugins: [],
}
