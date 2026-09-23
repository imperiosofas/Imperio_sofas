import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  APP_URL: z.url().default("http://localhost:3000"),
  INTEGRATION_MODE: z.enum(["mock", "sandbox", "live"]).default("mock"),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  MP_ACCESS_TOKEN: z.string().min(1).optional(),
  MP_WEBHOOK_SECRET: z.string().min(1).optional(),
  BLING_CLIENT_ID: z.string().min(1).optional(),
  BLING_CLIENT_SECRET: z.string().min(1).optional(),
  BLING_REDIRECT_URI: z.url().optional(),
  INTEGRATION_ENCRYPTION_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.email().optional(),
  CRON_SECRET: z.string().min(32).optional(),
  QUOTE_SIGNING_SECRET: z.string().min(32).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse(process.env);
}
