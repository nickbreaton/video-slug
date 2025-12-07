import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  // Enable CSS reset
  preflight: true,

  // Where to look for your css declarations
  include: ["./app/**/*.{ts,tsx,js,jsx}", "./components/**/*.{ts,tsx,js,jsx}"],

  // Files to exclude
  exclude: [],

  theme: {
    extend: {
      tokens: {
        colors: {
          // Accent palette, matching the globals.css HSL values
          accent: {
            50: { value: "hsl(0, 0%, 98%)" },
            100: { value: "hsl(0, 0%, 94%)" },
            200: { value: "hsl(0, 0%, 88%)" },
            300: { value: "hsl(0, 0%, 82%)" },
            400: { value: "hsl(0, 0%, 65%)" },
            500: { value: "hsl(0, 0%, 51%)" },
            600: { value: "hsl(0, 0%, 38%)" },
            700: { value: "hsl(0, 0%, 26%)" },
            800: { value: "hsl(0, 0%, 15%)" },
            900: { value: "hsl(0, 0%, 0%)" },
          },

          // Dark-mode accent palette; you can reference these in recipes or
          // use them with conditional styles (e.g. data-theme, media queries)
          accentDark: {
            50: { value: "hsl(220, 8%, 8%)" },
            100: { value: "hsl(220, 8%, 11%)" },
            200: { value: "hsl(220, 8%, 15%)" },
            300: { value: "hsl(220, 7%, 20%)" },
            400: { value: "hsl(220, 6%, 30%)" },
            500: { value: "hsl(220, 5%, 48%)" },
            600: { value: "hsl(220, 4%, 62%)" },
            700: { value: "hsl(220, 4%, 75%)" },
            800: { value: "hsl(220, 3%, 88%)" },
            900: { value: "hsl(220, 2%, 96%)" },
          },

          // Semantic colors for light mode – map to the accent scale
          background: { value: "{colors.accent.100}" },
          foreground: { value: "{colors.accent.900}" },

          // Semantic colors for dark mode – you can wire these up with
          // conditional styles (e.g. via a data-theme or class)
          backgroundDark: { value: "{colors.accentDark.50}" },
          foregroundDark: { value: "{colors.accentDark.900}" },
        },
      },
    },
  },

  // The output directory for your css system
  outdir: "styled-system",

  // Strict mode options for maximum type safety
  // Only allow token values for properties that have config tokens
  strictTokens: true,
});
