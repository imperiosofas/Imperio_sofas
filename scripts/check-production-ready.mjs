import { resolveRuntimeConfig } from "../src/lib/env/runtime-config.mjs";

const requiredForProduction = [
  "APP_URL",
  "CATALOG_SOURCE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MP_ACCESS_TOKEN",
  "MP_WEBHOOK_SECRET",
  "BLING_CLIENT_ID",
  "BLING_CLIENT_SECRET",
  "BLING_REDIRECT_URI",
  "INTEGRATION_ENCRYPTION_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "CRON_SECRET",
  "QUOTE_SIGNING_SECRET",
];

let runtimeConfig;

try {
  runtimeConfig = resolveRuntimeConfig(process.env);
} catch (error) {
  console.error("check:production falhou:");
  console.error(`- ${error.message}`);
  process.exit(1);
}

const mode = process.env.INTEGRATION_MODE ?? "mock";

if (runtimeConfig.appEnv !== "production") {
  console.log(`Production check skipped for APP_ENV=${runtimeConfig.appEnv}.`);
  process.exit(0);
}

const missing = requiredForProduction.filter(
  (name) => !process.env[name]?.trim(),
);
const errors = [];

if (mode !== "live")
  errors.push("APP_ENV=production exige INTEGRATION_MODE=live.");
if (runtimeConfig.catalogSource !== "supabase")
  errors.push("APP_ENV=production exige CATALOG_SOURCE=supabase.");
if (missing.length > 0)
  errors.push(`Variáveis ausentes: ${missing.join(", ")}.`);

if (errors.length > 0) {
  console.error("check:production falhou:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("check:production passou na validação estrutural de configuração.");
