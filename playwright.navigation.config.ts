import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3112";

if (process.env.NAV_ISOLATION_SENTINEL !== undefined) {
  throw new Error("Playwright runner received an inherited environment value");
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "navigation-initial-indicator.spec.ts",
  fullyParallel: false,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    reducedMotion: "no-preference",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3112",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
