import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f1f0ff",
          100: "#e5e3ff",
          200: "#cdc9ff",
          300: "#aca4ff",
          400: "#8b7bfd",
          500: "#7358f6",
          600: "#6238ea",
          700: "#522bcc",
          800: "#4425a3",
          900: "#392180",
        },
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 8px 24px -8px rgb(15 23 42 / 0.10)",
        card: "0 1px 2px 0 rgb(15 23 42 / 0.03), 0 12px 32px -12px rgb(15 23 42 / 0.12)",
        glow: "0 0 0 1px rgb(99 60 240 / 0.05), 0 12px 32px -8px rgb(99 60 240 / 0.35)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        "fade-in": "fade-in 0.4s ease-out both",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #6238ea 0%, #7358f6 50%, #9b5cf6 100%)",
        "brand-radial": "radial-gradient(circle at 20% -10%, rgba(115,88,246,0.16), transparent 55%)",
      },
    },
  },
  plugins: [],
};

export default config;
