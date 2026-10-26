import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getSafeAuthReturnTo } from "../../../lib/auth-return-to";
import {
  createConfirmationInterstitialResponse,
  type ConfirmationOtpType,
} from "../../../lib/auth/confirmation-interstitial";

function redirectNoStore(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function redirectToConfirmationError(
  request: NextRequest,
  destination: string,
) {
  const errorUrl = new URL("/conta", request.url);
  errorUrl.searchParams.set("erro", "confirmacao");
  if (destination !== "/conta") errorUrl.searchParams.set("next", destination);
  return redirectNoStore(errorUrl);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const requestedType = request.nextUrl.searchParams.get("type");
  const destination = getSafeAuthReturnTo(
    request.nextUrl.searchParams.get("next"),
  );
  const supabase = await createSupabaseServerClient();
  const type: ConfirmationOtpType | null =
    requestedType === "email" || requestedType === "recovery"
      ? requestedType
      : null;

  if (!supabase) {
    return redirectToConfirmationError(request, destination);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirectToConfirmationError(request, destination);
    return redirectNoStore(new URL(destination, request.url));
  }

  if (!tokenHash || !type || tokenHash.length > 2048) {
    return redirectToConfirmationError(request, destination);
  }

  return createConfirmationInterstitialResponse({
    actionPath: "/auth/confirm",
    tokenHash,
    type,
    nextPath: destination,
  });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const tokenHashValue = form.get("token_hash");
  const requestedType = form.get("type");
  const nextValue = form.get("next");
  const tokenHash = typeof tokenHashValue === "string" ? tokenHashValue : "";
  const destination = getSafeAuthReturnTo(
    typeof nextValue === "string" ? nextValue : undefined,
  );
  const type: ConfirmationOtpType | null =
    requestedType === "email" || requestedType === "recovery"
      ? requestedType
      : null;

  if (!tokenHash || tokenHash.length > 2048 || !type) {
    return redirectToConfirmationError(request, destination);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return redirectToConfirmationError(request, destination);
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) return redirectToConfirmationError(request, destination);

  return redirectNoStore(new URL(destination, request.url));
}
