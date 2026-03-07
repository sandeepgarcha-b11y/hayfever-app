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
        bark: {
          50:  "#f8f4ef",
          100: "#ece4d9",
          200: "#d9c9b4",
          300: "#c3a98c",
          400: "#ae8c69",
          500: "#9a7553",
          600: "#7d5e41",
          700: "#614832",
          800: "#463325",
          900: "#2c1f17",
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
