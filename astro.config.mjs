import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import { VitePWA } from "vite-plugin-pwa";
import { Duration } from "effect";

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  output: "server", // SSR mode for API routes
  adapter: node({
    mode: "standalone",
  }),
  vite: {
    plugins: [
      VitePWA({
        registerType: "prompt",
        manifest: {
          name: "DLP UI",
          short_name: "DLP",
          description: "DLP UI Application",
          theme_color: "#ffffff",
          icons: [],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-cache",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: Duration.toMillis(Duration.days(365)),
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true, // Enable PWA in dev mode for testing
        },
      }),
    ],
    ssr: {
      // Ensure Effect packages work properly in SSR
      noExternal: ["effect", "@effect/*"],
    },
  },
});
