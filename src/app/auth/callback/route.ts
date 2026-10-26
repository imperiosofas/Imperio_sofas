import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getSafeAuthReturnTo } from "../../../lib/auth-return-to";
import { createConfirmationInterstitialResponse } from "../../../lib/auth/confirmation-interstitial";

function redirectNoStore(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function redirectToAuthError(
  request: NextRequest,
  nextPath: string,
  errorType: "auth_callback" | "oauth" | "confirmacao",
) {
  const errorUrl = new URL("/conta", request.url);
  errorUrl.searchParams.set("erro", errorType);
  if (nextPath !== "/conta") errorUrl.searchParams.set("next", nextPath);
  return redirectNoStore(errorUrl);
}

function logCallbackDiagnostic(
  category: string,
  request: NextRequest,
  details: { codePresent?: boolean; errorCode?: string | null } = {},
) {
  const host = request.nextUrl.hostname;
  const hostCategory =
    host === "localhost"
      ? "localhost"
      : /^127\./.test(host)
        ? "loopback_ipv4"
        : "other";
  const verifierCookiePresent = request.cookies
    .getAll()
    .some(({ name }) => name.includes("-code-verifier"));

  console.info("[auth.callback]", {
    category,
    codePresent: details.codePresent ?? false,
    verifierCookiePresent,
    hostCategory,
    ...(details.errorCode ? { errorCode: details.errorCode } : {}),
  });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const nextPath = getSafeAuthReturnTo(
    request.nextUrl.searchParams.get("next"),
  );

  if (tokenHash && type === "email" && tokenHash.length <= 2048) {
    return createConfirmationInterstitialResponse({
      actionPath: "/auth/callback",
      tokenHash,
      type: "email",
      nextPath,
    });
  }

  const supabase = await createSupabaseServerClient();
  if (!code) {
    const providerError = request.nextUrl.searchParams.has("error");
    logCallbackDiagnostic(
      providerError ? "provider_error_without_code" : "missing_code",
      request,
    );
    return redirectToAuthError(
      request,
      nextPath,
      providerError ? "oauth" : "auth_callback",
    );
  }
  if (!supabase) {
    logCallbackDiagnostic("supabase_client_unavailable", request, {
      codePresent: true,
    });
    return redirectToAuthError(request, nextPath, "auth_callback");
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logCallbackDiagnostic("code_exchange_failed", request, {
      codePresent: true,
      errorCode: error.code,
    });
    return redirectToAuthError(request, nextPath, "auth_callback");
  }

  logCallbackDiagnostic("code_exchange_succeeded", request, {
    codePresent: true,
  });
  return redirectNoStore(new URL(nextPath, request.url));
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const tokenHashValue = form.get("token_hash");
  const typeValue = form.get("type");
  const nextValue = form.get("next");
  const tokenHash = typeof tokenHashValue === "string" ? tokenHashValue : "";
  const nextPath = getSafeAuthReturnTo(
    typeof nextValue === "string" ? nextValue : undefined,
  );

  if (!tokenHash || tokenHash.length > 2048 || typeValue !== "email") {
    logCallbackDiagnostic("invalid_email_confirmation_payload", request);
    return redirectToAuthError(request, nextPath, "confirmacao");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    logCallbackDiagnostic(
      "supabase_client_unavailable_for_token_hash",
      request,
    );
    return redirectToAuthError(request, nextPath, "confirmacao");
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });
  if (error) {
    logCallbackDiagnostic("token_hash_verification_failed", request, {
      errorCode: error.code,
    });
    return redirectToAuthError(request, nextPath, "confirmacao");
  }

  logCallbackDiagnostic("token_hash_verification_succeeded", request);
  return redirectNoStore(new URL(nextPath, request.url));
}
