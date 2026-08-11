import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve("src/web"),
  base: "./",
  envDir: resolve("."),
  resolve: {
    alias: {
      "@": resolve("src"),
      "@convex": resolve("convex"),
    },
  },
  plugins: [tailwindcss(), react()],
  build: {
    outDir: resolve("out/web"),
    emptyOutDir: true,
  },
  server: {
    port: 5180,
  },
});
