import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        arena: {
          bg: "#0b0e14",
          panel: "#141824",
          accent: "#4f9dff",
          danger: "#ff4f5e",
          xp: "#a970ff",
        },
      },
      fontFamily: {
        game: ["'Rubik'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
