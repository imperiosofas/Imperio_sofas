const requiredForProduction = [
  "APP_URL",
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

const appEnv = process.env.APP_ENV ?? "local";
const mode = process.env.INTEGRATION_MODE ?? "mock";

if (appEnv !== "production") {
  console.log(`Production check skipped for APP_ENV=${appEnv}.`);
  process.exit(0);
}

const missing = requiredForProduction.filter(
  (name) => !process.env[name]?.trim(),
);
const errors = [];

if (mode !== "live")
  errors.push("APP_ENV=production exige INTEGRATION_MODE=live.");
if (missing.length > 0)
  errors.push(`Variáveis ausentes: ${missing.join(", ")}.`);

if (errors.length > 0) {
  console.error("check:production falhou:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("check:production passou na validação estrutural de configuração.");
