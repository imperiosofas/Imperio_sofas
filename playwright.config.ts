import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3114";
const parsedBaseURL = new URL(baseURL);
const protocol = parsedBaseURL.protocol;
const hostname = parsedBaseURL.hostname;
const normalizedHostname =
  hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
const webServerHostname = normalizedHostname;

if (
  protocol !== "http:" ||
  !["127.0.0.1", "localhost", "::1"].includes(normalizedHostname)
) {
  throw new Error("Playwright E2E local só pode apontar para loopback.");
}

function envFileKeyNames(filePath: string): string[] {
  if (!existsSync(filePath)) return [];

  const keyNames = new Set<string>();
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const normalizedLine = line.replace(/^\uFEFF/, "");
    const match = normalizedLine.match(/^\s*(?:export\s+)?([\w.-]+)\s*(?:=|:)/);
    if (match) keyNames.add(match[1]);
  }
  return [...keyNames];
}

const nextEnvFileNames = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.test",
  ".env.test.local",
  ".env.production",
  ".env.production.local",
];
const inheritedEnvNames = Object.keys(process.env);
const dotenvKeyNames = nextEnvFileNames.flatMap((fileName) =>
  envFileKeyNames(resolve(process.cwd(), fileName)),
);
const safeRuntimeEnvNames = [
  "PATH",
  "SystemRoot",
  "WINDIR",
  "TEMP",
  "TMP",
  "PATHEXT",
  "COMSPEC",
  "USERPROFILE",
];
const sanitizedWebServerEnv: Record<string, string> = Object.fromEntries(
  inheritedEnvNames.map((name) => [name, ""]),
);

for (const name of safeRuntimeEnvNames) {
  const inheritedName = inheritedEnvNames.find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase(),
  );
  if (inheritedName && process.env[inheritedName] !== undefined) {
    sanitizedWebServerEnv[inheritedName] = process.env[inheritedName];
  }
}

for (const name of dotenvKeyNames) {
  sanitizedWebServerEnv[name] = "";
  const inheritedName = inheritedEnvNames.find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase(),
  );
  if (inheritedName) sanitizedWebServerEnv[inheritedName] = "";
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "list",
  use: {
    baseURL,
    reducedMotion: "no-preference",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], reducedMotion: "no-preference" },
    },
  ],
  webServer: {
    command: `node tests/e2e/assert-sanitized-env.mjs && npm run dev -- --hostname ${webServerHostname} --port ${parsedBaseURL.port || "80"}`,
    url: baseURL,
    reuseExistingServer: false,
    env: {
      ...sanitizedWebServerEnv,
      NEXT_DIST_DIR: ".next-e2e",
      APP_ENV: "local",
      CATALOG_SOURCE: "local",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    },
    timeout: 120_000,
  },
});
