import type { NextRequest } from "next/server";

/**
 * Login-CSRF guard for the auth POST routes. The confirmation interstitial
 * uses `Referrer-Policy: no-referrer`, so browsers send `Origin: null` even for
 * same-origin posts; `Sec-Fetch-Site` is unaffected by that policy and is the
 * primary signal. A cross-site form post is refused either way.
 */
export function isSameOriginPost(request: NextRequest) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (origin && origin !== "null" && origin !== request.nextUrl.origin)
    return false;
  return true;
}
