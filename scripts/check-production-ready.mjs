import { pathToFileURL } from "node:url";
import { resolveRuntimeConfig } from "../src/lib/env/runtime-config.mjs";

// Variables the running store actually reads in production. Each one is
// either needed for a page to work or for a security check to be enforced.
export const requiredForProduction = [
  "APP_URL", // canonical URLs, e-mails, payment return URLs
  "CATALOG_SOURCE", // must be supabase (checked below)
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY", // webhook, order e-mails, cron (server only)
  "MP_ACCESS_TOKEN",
  "MP_WEBHOOK_SECRET", // webhook signature check
  "MP_ENV", // must be "live" (checked below)
  "MP_EXPECTED_COLLECTOR_ID", // payments must go to the store's own account
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "CRON_SECRET", // protects /api/cron/expire-orders (32+ chars, checked below)
];

// Optional integrations: only validated when they are turned on. Bling (ERP)
// is not used by the store yet; if any of its variables is set, all of them
// must be, so a half-configured integration still fails the check.
export const optionalIntegrations = {
  Bling: [
    "BLING_CLIENT_ID",
    "BLING_CLIENT_SECRET",
    "BLING_REDIRECT_URI",
    "INTEGRATION_ENCRYPTION_KEY",
  ],
};

const filled = (env, name) => Boolean(env[name]?.trim());

/**
 * Structural production check. Returns errors (block the release) and
 * warnings (worth a look, do not block). Never prints secret values.
 *
 * @param {Record<string, string | undefined>} env
 */
export function checkProductionEnv(env) {
  const errors = [];
  const warnings = [];

  let runtimeConfig;
  try {
    runtimeConfig = resolveRuntimeConfig(env);
  } catch (error) {
    return { skipped: false, errors: [error.message], warnings };
  }
  if (runtimeConfig.appEnv !== "production")
    return { skipped: true, appEnv: runtimeConfig.appEnv, errors, warnings };

  if ((env.INTEGRATION_MODE ?? "mock").trim() !== "live")
    errors.push("APP_ENV=production exige INTEGRATION_MODE=live.");
  if (runtimeConfig.catalogSource !== "supabase")
    errors.push("APP_ENV=production exige CATALOG_SOURCE=supabase.");

  const missing = requiredForProduction.filter((name) => !filled(env, name));
  if (missing.length > 0)
    errors.push(`Variáveis ausentes: ${missing.join(", ")}.`);

  if (filled(env, "MP_ENV") && env.MP_ENV.trim() !== "live")
    errors.push("APP_ENV=production exige MP_ENV=live.");
  if (filled(env, "CRON_SECRET") && env.CRON_SECRET.trim().length < 32)
    errors.push("CRON_SECRET precisa ter pelo menos 32 caracteres.");
  if (filled(env, "APP_URL")) {
    try {
      const url = new URL(env.APP_URL.trim());
      if (url.protocol !== "https:")
        errors.push("APP_URL precisa usar https em produção.");
    } catch {
      errors.push("APP_URL não é uma URL válida.");
    }
  }

  for (const [name, variables] of Object.entries(optionalIntegrations)) {
    const set = variables.filter((variable) => filled(env, variable));
    if (set.length > 0 && set.length < variables.length) {
      const absent = variables.filter((variable) => !filled(env, variable));
      errors.push(
        `Integração ${name} configurada pela metade; faltam: ${absent.join(", ")}.`,
      );
    }
  }

  if (!filled(env, "STORE_NOTIFY_EMAIL"))
    warnings.push(
      "STORE_NOTIFY_EMAIL ausente: a cópia dos pedidos vai para o e-mail padrão da empresa.",
    );
  if (!filled(env, "SENTRY_DSN"))
    warnings.push(
      "SENTRY_DSN ausente: erros de produção não serão monitorados.",
    );

  return { skipped: false, errors, warnings };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = checkProductionEnv(process.env);
  if (result.skipped) {
    console.log(`Production check skipped for APP_ENV=${result.appEnv}.`);
    process.exit(0);
  }
  for (const warning of result.warnings) console.warn(`aviso: ${warning}`);
  if (result.errors.length > 0) {
    console.error("check:production falhou:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(
    "check:production passou na validação estrutural de configuração.",
  );
}
