import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // Server modules guard against client imports; tests run them directly.
      "server-only": path.resolve(import.meta.dirname, "test/empty.ts"),
    },
  },
  test: { include: ["src/**/*.test.ts"], setupFiles: ["dotenv/config"], testTimeout: 30_000 },
});
