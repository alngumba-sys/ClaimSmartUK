/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy teal — still used in dashboard/auth pages
        teal: {
          50: '#E1F5EE',
          100: '#9FE1CB',
          200: '#5DCAA5',
          400: '#1D9E75',
          600: '#0F6E56',
          800: '#085041',
          900: '#04342C',
        },
        // New brand palette — deep purple + gold (Second Brain aesthetic)
        cs: {
          dark:   '#0f0722',   // deepest bg
          purple: '#1a0f3c',   // hero bg
          mid:    '#2d1b69',   // section dividers / gradients
          gold:   '#d4960a',   // primary accent
          'gold-light': '#f0c040', // lighter gold for hover
          cream:  '#f7f2e8',   // card surface
          'cream-dark': '#ede8d8', // card border / muted
        },
      },
      fontFamily: {
        sans:  ['Manrope', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
