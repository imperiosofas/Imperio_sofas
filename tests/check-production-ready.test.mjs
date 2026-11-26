import assert from "node:assert/strict";
import { test } from "node:test";
import { checkProductionEnv } from "../scripts/check-production-ready.mjs";

// Placeholder values only: shape matters, never real credentials.
const complete = {
  APP_ENV: "production",
  INTEGRATION_MODE: "live",
  CATALOG_SOURCE: "supabase",
  APP_URL: "https://loja.example.test",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.example.test",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-placeholder",
  SUPABASE_SECRET_KEY: "secret-placeholder",
  MP_ACCESS_TOKEN: "token-placeholder",
  MP_WEBHOOK_SECRET: "webhook-placeholder",
  MP_ENV: "live",
  MP_EXPECTED_COLLECTOR_ID: "123456",
  RESEND_API_KEY: "resend-placeholder",
  RESEND_FROM_EMAIL: "Loja <pedidos@example.test>",
  CRON_SECRET: "x".repeat(40),
  STORE_NOTIFY_EMAIL: "loja@example.test",
  SENTRY_DSN: "https://sentry.example.test/1",
};

test("passes without Bling when every variable the store uses is set", () => {
  const result = checkProductionEnv(complete);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test("skips outside production", () => {
  const result = checkProductionEnv({
    APP_ENV: "staging",
    CATALOG_SOURCE: "supabase",
  });
  assert.equal(result.skipped, true);
});

test("still requires the variables the store actually reads", () => {
  for (const name of [
    "SUPABASE_SECRET_KEY",
    "MP_WEBHOOK_SECRET",
    "MP_EXPECTED_COLLECTOR_ID",
    "CRON_SECRET",
    "RESEND_API_KEY",
  ]) {
    const env = { ...complete, [name]: "" };
    const result = checkProductionEnv(env);
    assert.ok(
      result.errors.some((error) => error.includes(name)),
      `${name} should be required`,
    );
  }
});

test("enforces the same production rules as the running code", () => {
  assert.ok(
    checkProductionEnv({ ...complete, INTEGRATION_MODE: "sandbox" }).errors
      .length > 0,
  );
  assert.ok(
    checkProductionEnv({ ...complete, MP_ENV: "sandbox" }).errors.some((e) =>
      e.includes("MP_ENV=live"),
    ),
  );
  assert.ok(
    checkProductionEnv({ ...complete, CRON_SECRET: "short" }).errors.some((e) =>
      e.includes("32"),
    ),
  );
  assert.ok(
    checkProductionEnv({ ...complete, APP_URL: "http://loja.example.test" })
      .errors.length > 0,
  );
  assert.ok(
    checkProductionEnv({ ...complete, CATALOG_SOURCE: "local" }).errors.length >
      0,
  );
});

test("a half-configured Bling integration fails; a complete one passes", () => {
  const half = checkProductionEnv({ ...complete, BLING_CLIENT_ID: "id" });
  assert.ok(half.errors.some((e) => e.includes("Bling")));
  const full = checkProductionEnv({
    ...complete,
    BLING_CLIENT_ID: "id",
    BLING_CLIENT_SECRET: "secret",
    BLING_REDIRECT_URI: "https://loja.example.test/bling",
    INTEGRATION_ENCRYPTION_KEY: "key",
  });
  assert.deepEqual(full.errors, []);
});

test("optional settings only produce warnings", () => {
  const result = checkProductionEnv({
    ...complete,
    STORE_NOTIFY_EMAIL: "",
    SENTRY_DSN: "",
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 2);
});
