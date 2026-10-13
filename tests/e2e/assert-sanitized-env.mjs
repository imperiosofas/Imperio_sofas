if (
  Object.hasOwn(process.env, "E2E_ENV_SENTINEL") &&
  process.env.E2E_ENV_SENTINEL !== ""
) {
  throw new Error("Playwright webServer environment was not sanitized.");
}
