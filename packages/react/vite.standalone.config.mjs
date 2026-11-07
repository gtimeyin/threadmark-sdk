import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Script-tag build: React and every dependency bundled in, served as an ES module so the overlay's
// heavier pieces (screenshots, replay, video, tours) still load lazily as sibling chunks.
// Runs after the main build, into dist/embed/, without clearing dist/.
export default defineConfig({
  publicDir: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "dist/embed",
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL("./src/standalone.js", import.meta.url)),
      formats: ["es"],
      fileName: () => "threadmark.js",
    },
    minify: true,
    sourcemap: true,
    rollupOptions: {
      external: [/^node:/],
      output: { chunkFileNames: "chunks/[name]-[hash].js" },
    },
  },
});
