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
        background: "var(--background)",
        foreground: "var(--foreground)",
        'crypto-yield': '#1c6b47',
        'dividend': '#b7791f',
        'airdrop': '#6d4aa8',
        'ai-crypto': '#4338ca',
      },
    },
  },
  plugins: [],
};
export default config;
