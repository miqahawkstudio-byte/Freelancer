/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#dde6ff",
          200: "#c3d1ff",
          300: "#9cb2ff",
          400: "#7488ff",
          500: "#5160f8",
          600: "#3d44ed",
          700: "#3134d2",
          800: "#292baa",
          900: "#272a86",
        },
      },
    },
  },
  plugins: [],
};
