import assert from "node:assert/strict";
import test from "node:test";
import { resolveRuntimeConfig } from "../src/lib/env/runtime-config.mjs";

test("uses the safe local runtime defaults in development", () => {
  assert.deepEqual(resolveRuntimeConfig({ NODE_ENV: "development" }), {
    appEnv: "local",
    catalogSource: "local",
  });
  assert.deepEqual(resolveRuntimeConfig({}), {
    appEnv: "local",
    catalogSource: "local",
  });
});

test("requires APP_ENV during a production runtime", () => {
  assert.throws(
    () =>
      resolveRuntimeConfig({
        NODE_ENV: "production",
        CATALOG_SOURCE: "supabase",
      }),
    /APP_ENV must be set/,
  );
  assert.throws(
    () =>
      resolveRuntimeConfig({
        NODE_ENV: "production",
        APP_ENV: "",
        CATALOG_SOURCE: "supabase",
      }),
    /APP_ENV must be set/,
  );
});

test("requires an explicit Supabase catalog for staging", () => {
  assert.throws(
    () => resolveRuntimeConfig({ APP_ENV: "staging" }),
    /CATALOG_SOURCE must be explicitly set/,
  );
  assert.throws(
    () => resolveRuntimeConfig({ APP_ENV: "staging", CATALOG_SOURCE: "local" }),
    /require CATALOG_SOURCE=supabase/,
  );
  assert.deepEqual(
    resolveRuntimeConfig({ APP_ENV: "staging", CATALOG_SOURCE: "supabase" }),
    { appEnv: "staging", catalogSource: "supabase" },
  );
});

test("requires an explicit Supabase catalog for production", () => {
  assert.throws(
    () =>
      resolveRuntimeConfig({
        NODE_ENV: "production",
        APP_ENV: "local",
      }),
    /CATALOG_SOURCE must be explicitly set/,
  );
  assert.deepEqual(
    resolveRuntimeConfig({
      NODE_ENV: "production",
      APP_ENV: "local",
      CATALOG_SOURCE: "local",
    }),
    { appEnv: "local", catalogSource: "local" },
  );
  assert.throws(
    () =>
      resolveRuntimeConfig({
        APP_ENV: "production",
        CATALOG_SOURCE: "local",
      }),
    /require CATALOG_SOURCE=supabase/,
  );
  assert.deepEqual(
    resolveRuntimeConfig({
      APP_ENV: "production",
      CATALOG_SOURCE: "supabase",
    }),
    { appEnv: "production", catalogSource: "supabase" },
  );
});

test("rejects invalid runtime configuration without echoing values", () => {
  assert.throws(
    () => resolveRuntimeConfig({ APP_ENV: "secret-ish-value" }),
    (error) => {
      assert.match(error.message, /APP_ENV must be one of/);
      assert.doesNotMatch(error.message, /secret-ish-value/);
      return true;
    },
  );
  assert.throws(
    () => resolveRuntimeConfig({ CATALOG_SOURCE: "remote" }),
    /CATALOG_SOURCE must be one of/,
  );
  assert.throws(
    () => resolveRuntimeConfig({ APP_ENV: "production" }),
    /CATALOG_SOURCE must be explicitly set/,
  );
});
