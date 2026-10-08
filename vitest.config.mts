import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for server routes and client pages.
 *
 * Route handlers run in Node (the default). A test that renders React opts into
 * a DOM per file with a `// @vitest-environment jsdom` comment, so server tests
 * never pay for jsdom and never see a `window` they would not have in prod.
 *
 * External systems (Supabase, SBIePay, email) are always mocked at the module
 * boundary inside each test — nothing here talks to a network.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    alias: {
      "@/": fileURLToPath(new URL("./src/", import.meta.url)),
    },
    // Every test starts from fresh mocks: call history cleared, implementations
    // back to the factory default, spies restored.
    mockReset: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
});
