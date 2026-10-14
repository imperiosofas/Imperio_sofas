const appEnvironments = new Set(["local", "staging", "production"]);
const catalogSources = new Set(["local", "supabase"]);

/**
 * Resolve the non-secret runtime mode shared by the server and readiness checks.
 * Local development keeps its historical safe defaults; deployed environments
 * must select their persistent catalog explicitly.
 *
 * @param {Record<string, string | undefined>} env
 * @param {string | undefined} nodeEnv
 */
export function resolveRuntimeConfig(env, nodeEnv = env.NODE_ENV) {
  const configuredAppEnv = env.APP_ENV;

  if (configuredAppEnv === undefined || configuredAppEnv === "") {
    if (nodeEnv === "production") {
      throw new Error(
        "APP_ENV must be set to local, staging, or production when NODE_ENV=production.",
      );
    }
  } else if (!appEnvironments.has(configuredAppEnv)) {
    throw new Error("APP_ENV must be one of: local, staging, production.");
  }

  const appEnv = configuredAppEnv ?? "local";
  const configuredCatalogSource = env.CATALOG_SOURCE;
  let catalogSource = configuredCatalogSource;

  if (catalogSource === undefined || catalogSource === "") {
    if (nodeEnv === "production" || appEnv !== "local") {
      throw new Error(
        `CATALOG_SOURCE must be explicitly set when NODE_ENV=production or APP_ENV=${appEnv}.`,
      );
    }

    catalogSource = "local";
  } else if (!catalogSources.has(catalogSource)) {
    throw new Error("CATALOG_SOURCE must be one of: local, supabase.");
  }

  if (appEnv !== "local" && catalogSource !== "supabase") {
    throw new Error("Staging and production require CATALOG_SOURCE=supabase.");
  }

  return { appEnv, catalogSource };
}
