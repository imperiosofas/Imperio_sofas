import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getSafeAuthReturnTo } from "../../../lib/auth-return-to";

function redirectNoStore(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = getSafeAuthReturnTo(
    request.nextUrl.searchParams.get("next"),
  );
  const supabase = await createSupabaseServerClient();

  if (!code || !supabase) {
    return redirectNoStore(new URL("/conta?erro=oauth", request.url));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectNoStore(new URL("/conta?erro=oauth", request.url));
  }

  return redirectNoStore(new URL(nextPath, request.url));
}
