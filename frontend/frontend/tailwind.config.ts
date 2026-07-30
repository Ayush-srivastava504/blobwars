// Tailwind theme config: defines the arena color palette, game font,
// and small custom keyframe animations (fade/slide/zoom/pop) used by
// the kill feed, death overlay, and leaderboard. No plugins are used.
// Colors here mirror the arena-* class names used throughout the UI.
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
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        zoomIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.8)" },
          "60%": { opacity: "1", transform: "scale(1.05)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.3s ease-out",
        slideInRight: "slideInRight 0.3s ease-out",
        zoomIn: "zoomIn 0.3s ease-out",
        popIn: "popIn 0.35s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
