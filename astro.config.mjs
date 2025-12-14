import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  output: 'server', // SSR mode for API routes
  adapter: node({
    mode: 'standalone'
  }),
  vite: {
    ssr: {
      // Ensure Effect packages work properly in SSR
      noExternal: ['effect', '@effect/*']
    }
  }
});
