import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm cream backgrounds
        cream: {
          50:  "#fefcf8",
          100: "#faf7f0",
          200: "#f7f4ef",
          300: "#f0ebe0",
          400: "#e5ddd0",
          500: "#d6cbbA",
        },
        // Muted sage greens
        sage: {
          50:  "#f4f7f4",
          100: "#e4ece4",
          200: "#c6d9c7",
          300: "#9dbfa0",
          400: "#74a378",
          500: "#5c7a5f",
          600: "#4a6650",
          700: "#3b5240",
          800: "#2e4032",
          900: "#1f2e23",
        },
        // Warm clay / terracotta tints
        clay: {
          50:  "#fdf6f0",
          100: "#faeade",
          200: "#f4d0b5",
          300: "#ecb188",
          400: "#e09060",
          500: "#c97a45",
          600: "#a86035",
          700: "#854a28",
          800: "#5e331c",
          900: "#3d2011",
        },
        // Warm charcoal text
        charcoal: {
          50:  "#f5f4f3",
          100: "#e8e6e3",
          200: "#d0ccc7",
          300: "#b0aaa2",
          400: "#8e867c",
          500: "#706860",
          600: "#5a5249",
          700: "#453e38",
          800: "#2d2926",
          900: "#1a1714",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
