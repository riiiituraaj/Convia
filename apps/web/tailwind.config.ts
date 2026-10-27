import type { Config } from "tailwindcss";

/**
 * CONVIA design tokens.
 *
 * Single source of truth for the CONVIA visual language. Colors resolve through
 * CSS custom properties declared in `src/app/globals.css`, so light and dark
 * themes share the same class names.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          deep: "var(--brand-deep)",
          DEFAULT: "var(--brand-default)",
          mid: "var(--brand-mid)",
          accent: "var(--brand-accent)",
          light: "var(--brand-light)",
          pale: "var(--brand-pale)",
        },
        canvas: "var(--color-background)",
        surface: {
          DEFAULT: "var(--color-surface)",
          muted: "var(--surface-muted)",
          sunken: "var(--surface-sunken)",
        },
        ink: {
          DEFAULT: "var(--color-text)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          muted: "var(--color-text-muted)",
          disabled: "var(--color-text-disabled)",
        },
        line: {
          DEFAULT: "var(--color-border)",
          subtle: "var(--color-border-subtle)",
          strong: "var(--color-border-strong)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          light: "var(--color-danger-light)",
          subtle: "var(--color-danger-subtle)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          light: "var(--color-success-light)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          light: "var(--color-warning-light)",
          pale: "var(--color-warning-pale)",
          dark: "var(--color-warning-dark)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          light: "var(--color-info-light)",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "10px",
        md: "12px",
        lg: "14px",
        xl: "16px",
        "2xl": "18px",
      },
      backgroundImage: {
        "convia-hero": "var(--gradient-hero)",
        "convia-soft": "var(--gradient-soft)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        pop: "var(--shadow-pop)",
        focus: "var(--shadow-focus)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.98)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "fade-in": "fade-in 220ms ease-out both",
        "fade-in-up": "fade-in-up 240ms ease-out both",
        "scale-in": "scale-in 200ms ease-out both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
