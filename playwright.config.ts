import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1536, height: 1024 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chrome", use: { channel: "chrome" } },
    { name: "edge", use: { channel: "msedge" } },
  ],
  webServer: {
    command: "node node_modules/tsx/dist/cli.mjs tests/server.ts",
    url: "http://localhost:3100/api/navigation",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
