/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS config */
// Functional QA suite (AGENT 01) against the LOCAL production build connected
// to the Supabase TEST project. Payments must be in MOCK mode.
//   npx next build && npx next start -p 3190      (already running)
//   npx playwright test -c tests/e2e-qa/playwright.config.cjs
//   npx playwright test -c tests/e2e-qa/playwright.config.cjs a-new-customer
// Results JSON per spec + screenshots: <os tmpdir>/imperio-e2e-qa/
// globalSetup snapshots inventory; globalTeardown deletes leftover qa-* users /
// qa-produto-* products and verifies inventory equals the snapshot.
const path = require("path");
module.exports = {
  testDir: __dirname,
  testMatch: /\.qa\.spec\.cjs$/,
  timeout: 360000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["line"]],
  globalSetup: path.join(__dirname, "global-setup.cjs"),
  globalTeardown: path.join(__dirname, "global-teardown.cjs"),
  outputDir: path.join(require("os").tmpdir(), "imperio-e2e-qa", "pw-output"),
  use: {
    baseURL: process.env.QA_BASE_URL ?? "http://localhost:3190",
    browserName: "chromium",
    viewport: { width: 1366, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
};
