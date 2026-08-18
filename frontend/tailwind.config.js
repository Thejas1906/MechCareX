/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:    '#00224D',
        pink:    '#FF204E',
        crimson: '#A0153E',
        purple:  '#5D0E41',
      },
    },
  },
  plugins: [],
};
