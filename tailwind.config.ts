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
      spacing: {
        "os-1": "var(--space-1)",
        "os-2": "var(--space-2)",
        "os-3": "var(--space-3)",
        "os-4": "var(--space-4)",
        "os-5": "var(--space-5)",
        "os-6": "var(--space-6)",
        "os-8": "var(--space-8)",
        "os-10": "var(--space-10)",
        "os-12": "var(--space-12)",
      },
      boxShadow: {
        "os-0": "var(--elevation-0)",
        "os-1": "var(--elevation-1)",
        "os-2": "var(--elevation-2)",
        "os-nav-active": "var(--elevation-nav-active)",
      },
    },
  },
  plugins: [],
};
export default config;
