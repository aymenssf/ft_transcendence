/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,js,ts,tsx}",
    "./index.html",
    "./dist/**/*.{js}"
  ],
  theme: {
    extend: {
        fontFamily: {
          body: ['"Elms Sans"', 'sans-serif'],
          heading: ['"Merriweather"', 'serif'],
      },
    },
  },
  plugins: [],
};
