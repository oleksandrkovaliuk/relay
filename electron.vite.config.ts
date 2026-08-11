import { resolve } from "node:path";

import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

/** Every alias points inside the repo so any module can be reached as `@/<slice>/…`. */
const alias = {
  "@": resolve("src"),
  "@convex": resolve("convex"),
};

export default defineConfig({
  main: {
    resolve: { alias },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    resolve: { alias },
    build: {
      rollupOptions: {
        external: ["electron"],
        output: {
          entryFileNames: "[name].cjs",
          format: "cjs",
        },
      },
    },
  },
  renderer: {
    resolve: { alias },
    plugins: [
      tanstackRouter({
        target: "react",
        routesDirectory: resolve("src/renderer/routes"),
        generatedRouteTree: resolve("src/renderer/routeTree.gen.ts"),
        autoCodeSplitting: true,
      }),
      tailwindcss(),
      react(),
    ],
  },
});
