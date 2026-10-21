import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  publicDir: false,
  plugins: [react()],
  build: {
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL("./src/index.jsx", import.meta.url)),
      formats: ["es"],
      fileName: "index",
    },
    minify: false,
    sourcemap: true,
    rollupOptions: {
      // rrweb stays a runtime dependency; its stylesheet (imported with ?inline) is still bundled.
      external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", /^@solar-icons\/react(?:\/|$)/, /^rrweb$/],
      output: {
        banner: '"use client";',
      },
    },
  },
});
