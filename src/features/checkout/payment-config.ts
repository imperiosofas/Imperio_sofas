// Pure and dependency-free so it can be unit-tested without Next.js.
// The rule of this module: money can only move when the environment says so
// explicitly, and the mock provider can never run in production.

export type PaymentConfig =
  | { status: "ready"; provider: "mock" }
  | {
      status: "ready";
      provider: "mercadopago";
      environment: "sandbox" | "live";
      accessToken: string;
      webhookSecret: string;
      expectedCollectorId: string | null;
    }
  | { status: "disabled"; reason: PaymentDisabledReason };

export type PaymentDisabledReason =
  | "invalid_app_env"
  | "invalid_integration_mode"
  | "mock_not_allowed_in_production"
  | "sandbox_not_allowed_in_production"
  | "live_requires_production"
  | "missing_credentials"
  | "provider_environment_mismatch"
  | "missing_collector_id";

type Env = Record<string, string | undefined>;

const clean = (value: string | undefined) => value?.trim() || undefined;

export function resolvePaymentConfig(env: Env): PaymentConfig {
  const appEnv = clean(env.APP_ENV);
  if (appEnv !== "local" && appEnv !== "staging" && appEnv !== "production")
    return { status: "disabled", reason: "invalid_app_env" };

  const mode = clean(env.INTEGRATION_MODE) ?? "mock";

  if (mode === "mock") {
    return appEnv === "production"
      ? { status: "disabled", reason: "mock_not_allowed_in_production" }
      : { status: "ready", provider: "mock" };
  }

  if (mode !== "sandbox" && mode !== "live")
    return { status: "disabled", reason: "invalid_integration_mode" };

  const accessToken = clean(env.MP_ACCESS_TOKEN);
  const webhookSecret = clean(env.MP_WEBHOOK_SECRET);
  if (!accessToken || !webhookSecret)
    return { status: "disabled", reason: "missing_credentials" };

  const providerEnv = clean(env.MP_ENV);
  if (mode === "sandbox") {
    if (appEnv === "production")
      return {
        status: "disabled",
        reason: "sandbox_not_allowed_in_production",
      };
    if (providerEnv !== "sandbox")
      return { status: "disabled", reason: "provider_environment_mismatch" };
    return {
      status: "ready",
      provider: "mercadopago",
      environment: "sandbox",
      accessToken,
      webhookSecret,
      expectedCollectorId: clean(env.MP_EXPECTED_COLLECTOR_ID) ?? null,
    };
  }

  // live
  if (appEnv !== "production")
    return { status: "disabled", reason: "live_requires_production" };
  if (providerEnv !== "live")
    return { status: "disabled", reason: "provider_environment_mismatch" };
  const expectedCollectorId = clean(env.MP_EXPECTED_COLLECTOR_ID);
  if (!expectedCollectorId)
    return { status: "disabled", reason: "missing_collector_id" };
  return {
    status: "ready",
    provider: "mercadopago",
    environment: "live",
    accessToken,
    webhookSecret,
    expectedCollectorId,
  };
}
