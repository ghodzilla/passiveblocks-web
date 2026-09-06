import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        border: "var(--border)",
        surface: "var(--surface)",
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
          muted: "var(--accent-muted)",
        },
        status: {
          ok: "var(--status-ok)",
          warn: "var(--status-warn)",
          danger: "var(--status-danger)",
          neutral: "var(--status-neutral)",
        },
      },
      borderRadius: {
        os: "var(--radius-lg)",
      },
    },
  },
  plugins: [],
};
export default config;
