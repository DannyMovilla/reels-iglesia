import { resolve } from "node:path";
import { defineWorkspace } from "vitest/config";
import react from "@vitejs/plugin-react";

const alias = { "@shared": resolve(__dirname, "src/shared") };

export default defineWorkspace([
  {
    plugins: [react()],
    resolve: { alias },
    test: {
      name: "unit",
      globals: true,
      include: ["tests/main/**/*.test.ts", "tests/renderer/**/*.test.tsx", "tests/shared/**/*.test.ts"],
      environmentMatchGlobs: [["tests/renderer/**", "jsdom"]],
      setupFiles: ["tests/setup.ts"],
    },
  },
  {
    resolve: { alias },
    test: {
      name: "integracion",
      globals: true,
      include: ["tests/integracion/**/*.test.ts"],
      testTimeout: 600_000,
    },
  },
]);
