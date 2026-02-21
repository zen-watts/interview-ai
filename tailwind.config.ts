import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          bg: "var(--paper-bg)",
          elevated: "var(--paper-elevated)",
          border: "var(--paper-border)",
          muted: "var(--paper-muted)",
          accent: "var(--paper-accent)",
          danger: "var(--paper-danger)",
          ink: "var(--paper-ink)",
          softInk: "var(--paper-soft-ink)",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "serif"],
        sans: ["var(--font-sans)", "sans-serif"],
      },
      boxShadow: {
        none: "none",
      },
      borderRadius: {
        paper: "0.75rem",
      },
      maxWidth: {
        reading: "76rem",
      },
    },
  },
  plugins: [],
};

export default config;
