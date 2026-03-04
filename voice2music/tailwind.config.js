/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0a0a1a",
        accent: "#8b5cf6",
        glow: "#a78bfa",
      },
      boxShadow: {
        glow: "0 0 20px rgba(167, 139, 250, 0.6)",
      },
    },
  },
  plugins: [],
};
