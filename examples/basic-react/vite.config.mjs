import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { threadmarkTours } from "threadmark-react/vite";

export default defineConfig({
  // threadmarkTours() lets Tour mode's "Save to code" write src/tours/*.tour.json while developing.
  plugins: [react(), threadmarkTours({ dir: "src/tours" })],
  server: {
    port: Number(process.env.PORT) || 4174,
    strictPort: true,
  },
  preview: {
    port: 4174,
    strictPort: true,
  },
});
