/**
 * Local-only escape hatch for password/email MFA while developing the UI.
 * Never permits the bypass in production builds or in the hosted deployment.
 */
export function isPasswordEmailMfaDisabledForDevelopment() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DISABLE_PASSWORD_EMAIL_MFA === "true"
  );
}
