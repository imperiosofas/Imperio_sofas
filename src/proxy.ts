import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  catalogRouteExists,
  catalogRouteTarget,
} from "./lib/catalog-route-exists";
import { supabaseCookieOptions } from "./lib/supabase/cookie-options";

export async function proxy(request: NextRequest) {
  // Lets server layouts (e.g. /admin) know the requested path for login
  // redirects. Informational only: never used for authorization.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  const forward = () =>
    NextResponse.next({ request: { headers: requestHeaders } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return forward();

  // QA-03: unknown product/category URLs get a real 404 (see the module).
  const target = catalogRouteTarget(request.nextUrl.pathname);
  if (target && (request.method === "GET" || request.method === "HEAD")) {
    const exists = await catalogRouteExists(target.kind, target.slug, url, key);
    if (exists === false) {
      return NextResponse.rewrite(new URL("/_catalog-not-found", request.url), {
        status: 404,
      });
    }
  }

  let response = forward();
  const supabase = createServerClient(url, key, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        // Forward the refreshed cookies to the server render as well.
        requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
        response = forward();
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresh/validate the cookie-backed session; authorization stays in server pages/actions.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
