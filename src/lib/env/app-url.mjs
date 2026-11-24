/** Resolve the metadata base without exposing invalid configuration values. */
export function resolveAppUrl(env = process.env) {
  const configured = env.APP_URL?.trim();

  if (configured) {
    try {
      const url = new URL(configured);
      if (
        !/^https?:\/\//i.test(configured) ||
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      ) {
        throw new Error();
      }
      return url;
    } catch {
      throw new Error(
        "APP_URL must be an absolute HTTP(S) URL without credentials.",
      );
    }
  }

  // Production deployments must use the public production domain: the
  // per-deployment VERCEL_URL sits behind Vercel Authentication, so payment
  // notifications and return URLs sent there never reach the app.
  const productionHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (env.VERCEL_ENV === "production" && productionHost) {
    try {
      const url = new URL(`https://${productionHost}`);
      if (
        url.host === productionHost.toLowerCase() &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash &&
        !url.username &&
        !url.password
      )
        return url;
    } catch {
      // fall through to the deployment host
    }
  }

  const deploymentHost = env.VERCEL_URL?.trim();
  if (deploymentHost) {
    try {
      const url = new URL(`https://${deploymentHost}`);
      if (
        url.host !== deploymentHost.toLowerCase() ||
        url.pathname !== "/" ||
        url.search ||
        url.hash ||
        url.username ||
        url.password
      ) {
        throw new Error();
      }
      return url;
    } catch {
      throw new Error(
        "VERCEL_URL must be a deployment hostname without a URL scheme or path.",
      );
    }
  }

  if ((env.APP_ENV && env.APP_ENV !== "local") || env.VERCEL === "1") {
    throw new Error(
      "APP_URL or VERCEL_URL is required outside the local environment.",
    );
  }

  return new URL("http://localhost:3000");
}
