/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {

        orion: {
          burgundy: '#8C1F25',
          'burgundy-hover': '#74191E',
          'burgundy-dark': '#580F14',
          'burgundy-light': '#F8E8E9',
          cream: '#FAF5ED',
          'cream-soft': '#FBF7F0',
          'cream-border': '#EADBCE',
          card: '#F1DFC4',
          'card-hover': '#ECD8BB',
          'card-border': '#DFCAA9',
          dark: '#2A1B16',
          muted: '#7B685C',
          lightmuted: '#9E8B7F',
          surface: '#FFFFFF',
          gold: '#C59A45',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        cormorant: ['"Cormorant Garamond"', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'warm': '0 8px 30px -4px rgba(140, 31, 37, 0.08), 0 4px 12px rgba(42, 27, 22, 0.04)',
        'card': '0 12px 35px -8px rgba(120, 75, 45, 0.12), 0 4px 10px rgba(0, 0, 0, 0.03)',
        'btn': '0 4px 14px rgba(140, 31, 37, 0.35)',
      }
    },
  },
  plugins: [],
}


