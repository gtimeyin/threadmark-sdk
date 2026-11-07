# Script tag example

Threadmark on a plain HTML page, with no React and no build step for the page itself.

```bash
npm run build:sdk                      # from the repository root
npm run dev --workspace threadmark-script-tag-example   # http://localhost:4180/
```

The page loads `/threadmark.js` (the locally built `packages/react/dist/embed/`, served by a plain static server the way a CDN would) and calls `mount()` with callbacks that keep comments in `localStorage`. That storage is for trying it out: it lives in one browser and drops screenshots. For a team, send the callbacks to your own backend; see [setting up your own storage](../../packages/react/README.md#setting-up-your-own-storage).
