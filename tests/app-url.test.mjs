import assert from "node:assert/strict";
import test from "node:test";
import { resolveAppUrl } from "../src/lib/env/app-url.mjs";

const observedPreviewHost = "imperio-sofas-120uwdcvm-imperio-sofas.vercel.app";

test("missing, empty and whitespace APP_URL use localhost locally", () => {
  for (const APP_URL of [undefined, "", "  "]) {
    assert.equal(
      resolveAppUrl({ APP_ENV: "local", APP_URL }).href,
      "http://localhost:3000/",
    );
  }
  assert.equal(resolveAppUrl({}).href, "http://localhost:3000/");
});

test("missing and blank APP_URL use the actual Vercel preview hostname over HTTPS", () => {
  for (const APP_URL of [undefined, "", "  "]) {
    assert.equal(
      resolveAppUrl({
        APP_ENV: "staging",
        APP_URL,
        VERCEL_URL: observedPreviewHost,
      }).href,
      `https://${observedPreviewHost}/`,
    );
  }
});

test("valid explicit URL takes precedence and preserves its base path", () => {
  assert.equal(
    resolveAppUrl({
      APP_URL: `  https://${observedPreviewHost}/base/  `,
      VERCEL_URL: "invalid/host",
    }).href,
    `https://${observedPreviewHost}/base/`,
  );
  assert.equal(
    resolveAppUrl({ APP_URL: "http://localhost:3105" }).href,
    "http://localhost:3105/",
  );
});

test("invalid explicit URLs and protocols fail without falling back or leaking input", () => {
  for (const APP_URL of [
    "private-sentinel",
    "/relative",
    "http://",
    "https:missing-slashes",
    "ftp://private-sentinel",
    "javascript:private-sentinel",
    "https://user:private-sentinel@example.invalid",
  ]) {
    assert.throws(
      () => resolveAppUrl({ APP_URL, VERCEL_URL: observedPreviewHost }),
      (error) => {
        assert.equal(
          error.message,
          "APP_URL must be an absolute HTTP(S) URL without credentials.",
        );
        assert.equal(error.cause, undefined);
        assert.doesNotMatch(error.stack, /private-sentinel/);
        return true;
      },
    );
  }
});

test("invalid VERCEL_URL fails with a sanitized hostname error", () => {
  for (const VERCEL_URL of [
    "https://private-sentinel.vercel.app",
    "host.vercel.app/private-sentinel",
    "user:private-sentinel@host.vercel.app",
    "host.vercel.app?private-sentinel",
  ]) {
    assert.throws(
      () => resolveAppUrl({ APP_URL: "", VERCEL_URL }),
      (error) => {
        assert.match(
          error.message,
          /^VERCEL_URL must be a deployment hostname/,
        );
        assert.doesNotMatch(error.stack, /private-sentinel/);
        assert.equal(error.cause, undefined);
        return true;
      },
    );
  }
});

test("deployed environments cannot silently use localhost without a base URL", () => {
  for (const env of [
    { APP_ENV: "staging" },
    { APP_ENV: "production", APP_URL: "" },
    { VERCEL: "1" },
  ]) {
    assert.throws(
      () => resolveAppUrl(env),
      /APP_URL or VERCEL_URL is required outside the local environment/,
    );
  }
});

test("resolved bases support absolute product and sitemap URLs", () => {
  const base = resolveAppUrl({ APP_URL: "", VERCEL_URL: observedPreviewHost });
  assert.equal(
    new URL("/produto/berlim", base).href,
    `https://${observedPreviewHost}/produto/berlim`,
  );
  assert.equal(
    new URL("/sitemap.xml", base).href,
    `https://${observedPreviewHost}/sitemap.xml`,
  );
});

test("resolution leaves the supplied environment unchanged", () => {
  const env = Object.freeze({ APP_URL: "", VERCEL_URL: observedPreviewHost });
  resolveAppUrl(env);
  assert.equal(env.APP_URL, "");
});
