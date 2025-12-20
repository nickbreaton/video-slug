import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";

import vitePwa from "@vite-pwa/astro";

// https://astro.build/config
export default defineConfig({
  integrations: [react(), vitePwa()],
  output: "server", // SSR mode for API routes
  adapter: node({
    mode: "standalone",
  }),
  vite: {
    plugins: [],
  },
});