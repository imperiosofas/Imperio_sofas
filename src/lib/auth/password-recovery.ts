// Short-lived marker set only after a password-recovery link is verified.
export const PASSWORD_RECOVERY_COOKIE = "pw_recovery";
export const PASSWORD_RECOVERY_PATH = "/conta/redefinir-senha";

export const passwordRecoveryCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: PASSWORD_RECOVERY_PATH,
  maxAge: 15 * 60,
};
