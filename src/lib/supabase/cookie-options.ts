// Session cookies are sent only over HTTPS in production. They stay readable
// by the browser client (@supabase/ssr needs that for client-side auth calls),
// so XSS defenses (headers/CSP) remain important.
export const supabaseCookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
