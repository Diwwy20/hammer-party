import { defineConfig } from "vitest/config";

/**
 * One test run for the whole monorepo.
 *
 * We only unit-test the PURE parts — the rules that decide an outcome from plain
 * inputs (hit cone, zone curve, standings, awards, name sanitising, math). Anything
 * that needs a live socket, a Colyseus room or a WebGL canvas is covered by the
 * headless end-to-end smoke instead; mocking it here would only test the mocks.
 */
export default defineConfig({
  test: {
    // colocated with the code they cover: src/foo.ts ← src/foo.test.ts
    include: ["packages/*/src/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
  },
});
