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
      semanticTokens: {
        colors: {
          accent: {
            50: { value: { base: "hsl(0, 0%, 98%)", _osDark: "hsl(220, 8%, 8%)" } },
            100: { value: { base: "hsl(0, 0%, 94%)", _osDark: "hsl(220, 8%, 11%)" } },
            200: { value: { base: "hsl(0, 0%, 88%)", _osDark: "hsl(220, 8%, 15%)" } },
            300: { value: { base: "hsl(0, 0%, 82%)", _osDark: "hsl(220, 7%, 20%)" } },
            400: { value: { base: "hsl(0, 0%, 65%)", _osDark: "hsl(220, 6%, 30%)" } },
            500: { value: { base: "hsl(0, 0%, 51%)", _osDark: "hsl(220, 5%, 48%)" } },
            600: { value: { base: "hsl(0, 0%, 38%)", _osDark: "hsl(220, 4%, 62%)" } },
            700: { value: { base: "hsl(0, 0%, 26%)", _osDark: "hsl(220, 4%, 75%)" } },
            800: { value: { base: "hsl(0, 0%, 15%)", _osDark: "hsl(220, 3%, 88%)" } },
            900: { value: { base: "hsl(0, 0%, 0%)", _osDark: "hsl(220, 2%, 96%)" } },
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
