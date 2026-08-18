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
    server: {
      // The window is served from `relay://renderer/` so Clerk sees one stable, secure
      // origin in development and production alike. Vite otherwise derives its HMR
      // WebSocket url from `location`, and `ws://renderer/` does not resolve — so name
      // the dev server the relay protocol is proxying to. Vite's client still probes the
      // page-relative url first and logs one failed WebSocket before taking this route;
      // that notice is expected, and HMR works from the fallback connection.
      hmr: { protocol: "ws", host: "localhost", port: 5173 },
    },
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
