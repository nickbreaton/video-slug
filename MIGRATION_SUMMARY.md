# Migration Summary: Next.js → Astro

## ✅ Migration Complete!

This document summarizes the successful migration from Next.js 16 to Astro 5 while maintaining React support.

---

## What Was Changed

### 1. **Dependencies**
- ❌ Removed: `next`, `eslint-config-next`
- ✅ Added: `astro`, `@astrojs/react`, `@astrojs/node`, `@astrojs/check`

### 2. **Configuration Files**

#### Created:
- `astro.config.mjs` - Main Astro configuration with React integration and Node adapter
- `src/` directory structure - New Astro-standard directory layout

#### Updated:
- `tsconfig.json` - Extends Astro's strict config, updated paths from `@/` → `@/src/*`
- `package.json` - Updated scripts to use Astro CLI, added `"type": "module"`
- `panda.config.ts` - Updated include paths to scan `src/**/*.{ts,tsx,js,jsx,astro}`
- `.gitignore` - Replaced `.next/` with `.astro/` and `dist/`

#### Deleted:
- `next.config.ts`
- `next-env.d.ts`
- `postcss.config.mjs`
- `app/` directory (old Next.js structure)

### 3. **Project Structure**

```
Before (Next.js)              After (Astro)
─────────────────────────────────────────────────
app/                       →  src/
  ├── api/rpc/route.ts     →    ├── pages/
  ├── layout.tsx           →    │   ├── index.astro
  ├── page.tsx             →    │   └── api/rpc.ts
  ├── globals.css          →    ├── layouts/
  ├── rpc/download.ts      →    │   └── BaseLayout.astro
  ├── schema.ts            →    ├── components/
  └── favicon.ico          →    │   └── HomePage.tsx
                                 ├── lib/
public/                    →    │   ├── schema.ts
                                 │   └── rpc/download.ts
                                 └── styles/
                                     └── globals.css
```

### 4. **File Conversions**

#### `app/layout.tsx` → `src/layouts/BaseLayout.astro`
- Converted from React component to Astro layout
- Replaced `next/font/google` with direct Google Fonts links
- Removed Next.js `Metadata` export
- Used Astro's `<slot />` for content injection

#### `app/page.tsx` → `src/components/HomePage.tsx` + `src/pages/index.astro`
- Split into:
  - React component (`HomePage.tsx`) - Contains all client-side logic
  - Astro page (`index.astro`) - Server-rendered wrapper with `client:load` directive

#### `app/api/rpc/route.ts` → `src/pages/api/rpc.ts`
- Converted Next.js API route to Astro API endpoint
- Changed export from `export const POST = (request: Request)` to `export const POST: APIRoute`
- Added `export const prerender = false` to ensure SSR
- Updated imports to use new `@/lib/*` paths

#### Path Updates
All imports updated from:
- `@/app/schema` → `@/lib/schema`
- `@/app/rpc/download` → `@/lib/rpc/download`
- `@/styled-system/css` → `../../styled-system/css` (relative paths)

---

## NPM Scripts

```json
{
  "dev": "bunx --bun astro dev",        // Start dev server (http://localhost:4321)
  "build": "bunx --bun astro build",    // Production build to dist/
  "preview": "bunx --bun astro preview", // Preview production build
  "start": "bun run preview",           // Alias for preview
  "check": "astro check",               // TypeScript type checking
  "lint": "eslint"                      // ESLint (unchanged)
}
```

---

## Key Differences: Next.js vs Astro

| Feature | Next.js | Astro |
|---------|---------|-------|
| **Dev Server** | `localhost:3000` | `localhost:4321` |
| **Client Components** | `"use client"` directive | `client:load` in `.astro` files |
| **API Routes** | `app/api/*/route.ts` | `src/pages/api/*.ts` |
| **Layouts** | `layout.tsx` (React) | `.astro` layout files |
| **Pages** | `page.tsx` | `.astro` or wrapped React in `pages/` |
| **Font Loading** | `next/font` | Google Fonts or Fontsource |
| **Build Output** | `.next/` | `dist/` |
| **Type Generation** | Automatic | Run `astro check` |

---

## Astro-Specific Patterns

### Client Directives
React components in `.astro` files need hydration directives:

```astro
<HomePage client:load />      <!-- Load immediately -->
<Component client:idle />     <!-- Load when idle -->
<Component client:visible />  <!-- Load when visible -->
<Component client:only="react" /> <!-- Only render on client -->
```

### API Routes
Astro API routes export HTTP method handlers:

```typescript
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, params, cookies }) => {
  return new Response(JSON.stringify({ message: 'Hello' }));
};

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();
  return new Response(JSON.stringify(data));
};

export const prerender = false; // Disable prerendering for dynamic routes
```

---

## What Still Works

✅ **All Effect-TS functionality** - RPC, atoms, state management  
✅ **Panda CSS** - All styling utilities and tokens  
✅ **React 19** - Full React support with hooks and components  
✅ **Bun runtime** - SQLite, yt-dlp, file operations  
✅ **TypeScript** - Full type safety maintained  
✅ **ESLint** - Linting configuration intact  

---

## Testing Results

### ✅ Type Checking
```bash
bun run check
# Result: 0 errors, 0 warnings, 0 hints (77 files)
```

### ✅ Production Build
```bash
bun run build
# Result: Build complete! (dist/ directory created)
# - Server entrypoints built
# - Client assets optimized
# - Static routes prerendered
```

### ✅ Development Server
```bash
bun run dev
# Result: Server running at http://localhost:4321/
```

---

## Next Steps

### Optional Improvements

1. **Font Optimization** (Optional)
   ```bash
   bun add @fontsource/geist-sans @fontsource/geist-mono
   ```
   Import in layout:
   ```astro
   ---
   import '@fontsource/geist-sans';
   import '@fontsource/geist-mono';
   ---
   ```

2. **Environment Variables**
   - Prefix with `PUBLIC_` for client-side access
   - Example: `PUBLIC_API_URL` in `.env`

3. **Update Deployment**
   - If using Vercel/Netlify, update build commands
   - Build command: `bun run build`
   - Output directory: `dist/`
   - Node version: 18+ recommended

4. **Add Astro Components**
   - Consider converting some React components to `.astro` for better performance
   - Use React only where interactivity is needed

---

## Troubleshooting

### Issue: Module not found errors
- **Solution**: Ensure all imports use `@/lib/*` or `@/components/*`
- Run `bun run check` to verify paths

### Issue: Styles not applying
- **Solution**: Regenerate Panda CSS: `bunx panda codegen`

### Issue: Effect-TS errors in build
- **Solution**: Already configured in `astro.config.mjs`:
  ```js
  vite: {
    ssr: {
      noExternal: ['effect', '@effect/*']
    }
  }
  ```

---

## Migration Statistics

- **Files Modified**: 8
- **Files Created**: 8
- **Files Deleted**: 11 (+ entire `app/` directory)
- **Dependencies Removed**: 2
- **Dependencies Added**: 4
- **Build Time**: ~5 seconds
- **Bundle Size**: Client JS ~527 KB (gzipped: ~170 KB)

---

## References

- [Astro Documentation](https://docs.astro.build)
- [Astro + React Guide](https://docs.astro.build/en/guides/integrations-guide/react/)
- [Astro API Routes](https://docs.astro.build/en/guides/endpoints/)
- [Panda CSS](https://panda-css.com)
- [Effect-TS](https://effect.website)

---

**Migration Completed**: Successfully migrated from Next.js to Astro while maintaining all functionality ✅