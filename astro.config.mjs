import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import serviceWorker from "astrojs-service-worker";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "node:path";

// https://astro.build/config
export default defineConfig({
  integrations: [react(), serviceWorker()],
  output: "static", // Static mode with server-rendered API routes (prerender: false)
  adapter: node({
    mode: "standalone",
  }),
  vite: {
    plugins: [tailwindcss(), import.meta.env.BASIC_SSL && basicSsl()],
    worker: {
      rollupOptions: {
        output: {
          format: "es",
        },
      },
    },
    resolve: {
      alias: {
        // Needed for proper resolution inside workers
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  },
});
