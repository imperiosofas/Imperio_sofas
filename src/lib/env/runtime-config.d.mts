export type AppEnvironment = "local" | "staging" | "production";
export type CatalogSource = "local" | "supabase";

export type RuntimeConfig = {
  appEnv: AppEnvironment;
  catalogSource: CatalogSource;
};

export function resolveRuntimeConfig(
  env: Record<string, string | undefined>,
  nodeEnv?: string,
): RuntimeConfig;
