import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const baseURL = "http://127.0.0.1:3112";
const sentinelName = "NAV_ISOLATION_SENTINEL";

// Seed a throwaway inherited value so the runner and worker assertions prove
// that arbitrary parent-only variables do not cross the process boundary.
process.env[sentinelName] ??= `${Date.now()}-${Math.random()}`;

const isolatedEnv = {};
for (const name of [
  "PATH",
  "Path",
  "PATHEXT",
  "ComSpec",
  "SystemRoot",
  "WINDIR",
  "SystemDrive",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "HOMEDRIVE",
  "HOMEPATH",
  "ProgramFiles",
  "ProgramFiles(x86)",
]) {
  const value = process.env[name];
  if (value) isolatedEnv[name] = value;
}

for (const fileName of readdirSync(projectRoot).filter((name) =>
  /^\.env(?:\..+)?$/.test(name),
)) {
  const contents = readFileSync(join(projectRoot, fileName), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) isolatedEnv[match[1]] = "";
  }
}

Object.assign(isolatedEnv, {
  APP_ENV: "local",
  APP_URL: baseURL,
  CATALOG_SOURCE: "local",
  NODE_ENV: "production",
  NEXT_DIST_DIR: ".next-nav-security-review",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
});

const playwrightCli = join(
  projectRoot,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);
const child = spawn(
  process.execPath,
  [playwrightCli, "test", ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    env: isolatedEnv,
    stdio: "inherit",
  },
);

child.on("error", () => {
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
