import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve("src"),
      "@convex": resolve("convex"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.live.test.ts"],
    testTimeout: 300_000,
  },
});
