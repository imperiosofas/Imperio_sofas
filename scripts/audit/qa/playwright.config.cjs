// QA against a local production build connected to the Supabase TEST project:
//   npm run build && npx next start -p 3190
//   npx playwright test -c scripts/audit/qa/playwright.config.cjs
module.exports = {
  testDir: __dirname,
  testMatch: /-flow\.spec\.cjs$/,
  timeout: 300000,
  workers: 1,
  reporter: "line",
  use: { browserName: "chromium", viewport: { width: 1366, height: 900 } },
};
