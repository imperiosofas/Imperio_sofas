import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getSafeAuthReturnTo } from "../../../lib/auth-return-to";
import {
  createConfirmationInterstitialResponse,
  type ConfirmationOtpType,
} from "../../../lib/auth/confirmation-interstitial";
import { isSameOriginPost } from "../../../lib/auth/same-origin";
import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_PATH,
  passwordRecoveryCookieOptions,
} from "../../../lib/auth/password-recovery";

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
  const type: ConfirmationOtpType | null =
    requestedType === "email" || requestedType === "recovery"
      ? requestedType
      : null;

  if (code) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return redirectToConfirmationError(request, destination);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirectToConfirmationError(request, destination);
    const response = redirectNoStore(new URL(destination, request.url));
    // PKCE recovery links come back here with next=/conta/redefinir-senha.
    if (destination === PASSWORD_RECOVERY_PATH && data.user)
      response.cookies.set(
        PASSWORD_RECOVERY_COOKIE,
        data.user.id,
        passwordRecoveryCookieOptions,
      );
    return response;
  }

  if (!tokenHash || !type || tokenHash.length > 2048) {
    return redirectToConfirmationError(request, destination);
  }

  // The interstitial only renders a form; the token is verified on POST.
  return createConfirmationInterstitialResponse({
    actionPath: "/auth/confirm",
    tokenHash,
    type,
    nextPath: destination,
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request))
    return redirectToConfirmationError(request, "/conta");
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

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) return redirectToConfirmationError(request, destination);

  const response = redirectNoStore(new URL(destination, request.url));
  // Only a fresh recovery link unlocks /conta/redefinir-senha (no current
  // password asked there); any other session must use /conta/seguranca.
  if (type === "recovery" && data.user)
    response.cookies.set(
      PASSWORD_RECOVERY_COOKIE,
      data.user.id,
      passwordRecoveryCookieOptions,
    );
  return response;
}
