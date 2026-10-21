import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  publicDir: false,
  plugins: [react()],
  build: {
    emptyOutDir: true,
    lib: {
      // `tours` is the production-safe player entry; it must not import the review overlay.
      entry: {
        index: fileURLToPath(new URL("./src/index.jsx", import.meta.url)),
        tours: fileURLToPath(new URL("./src/tours.js", import.meta.url)),
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    minify: false,
    sourcemap: true,
    rollupOptions: {
      // rrweb stays a runtime dependency; its stylesheet (imported with ?inline) is still bundled.
      external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", /^@solar-icons\/react(?:\/|$)/, /^rrweb$/],
      output: {
        banner: '"use client";',
        // Name the code both entries share, so the review bundle doesn't appear to import "tours".
        manualChunks: (id) => (id.endsWith("/src/targetId.js") ? "targetId" : undefined),
      },
    },
  },
});
