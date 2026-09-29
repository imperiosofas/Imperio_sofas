import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getSafeAuthReturnTo } from "../../../lib/auth-return-to";

function redirectNoStore(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const requestedType = request.nextUrl.searchParams.get("type");
  const destination = getSafeAuthReturnTo(
    request.nextUrl.searchParams.get("next"),
  );
  const supabase = await createSupabaseServerClient();
  const type: EmailOtpType | null =
    requestedType === "email" || requestedType === "recovery"
      ? requestedType
      : null;

  if (!tokenHash || !type || !supabase) {
    return redirectNoStore(new URL("/conta?erro=confirmacao", request.url));
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return redirectNoStore(new URL("/conta?erro=confirmacao", request.url));
  }

  return redirectNoStore(new URL(destination, request.url));
}
