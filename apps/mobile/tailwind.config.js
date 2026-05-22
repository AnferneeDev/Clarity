/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        accent: "#2a1636",
        sidebar: "#0a0810",
        glass: "rgba(255, 255, 255, 0.05)",
        "glass-border": "rgba(255, 255, 255, 0.1)",
      },
    },
  },
  plugins: [],
}
