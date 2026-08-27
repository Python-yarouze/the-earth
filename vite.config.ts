import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
  },
});
