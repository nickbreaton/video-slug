import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  // Enable CSS reset
  preflight: true,

  // Where to look for your css declarations
  include: ["./src/**/*.{ts,tsx,js,jsx,astro}", "./components/**/*.{ts,tsx,js,jsx}"],

  // Files to exclude
  exclude: [],

  theme: {
    extend: {
      semanticTokens: {
        colors: {
          accent: {
            50: { value: { base: "hsl(0, 0%, 98%)", _osDark: "hsl(220, 10%, 12%)" } },
            100: { value: { base: "hsl(0, 0%, 94%)", _osDark: "hsl(220, 10%, 16%)" } },
            200: { value: { base: "hsl(0, 0%, 88%)", _osDark: "hsl(220, 9%, 22%)" } },
            300: { value: { base: "hsl(0, 0%, 82%)", _osDark: "hsl(220, 8%, 28%)" } },
            400: { value: { base: "hsl(0, 0%, 65%)", _osDark: "hsl(220, 6%, 42%)" } },
            500: { value: { base: "hsl(0, 0%, 51%)", _osDark: "hsl(220, 5%, 55%)" } },
            600: { value: { base: "hsl(0, 0%, 38%)", _osDark: "hsl(220, 5%, 68%)" } },
            700: { value: { base: "hsl(0, 0%, 26%)", _osDark: "hsl(220, 6%, 72%)" } },
            800: { value: { base: "hsl(0, 0%, 15%)", _osDark: "hsl(220, 8%, 82%)" } },
            900: { value: { base: "hsl(0, 0%, 0%)", _osDark: "hsl(220, 10%, 90%)" } },
          },

          background: { value: "{colors.accent.50}" },
          foreground: { value: "{colors.accent.900}" },
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
