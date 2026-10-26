type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };
/** Best-effort process-local guard; not a cross-instance security boundary. */
export function createQuoteRateLimiter(options?: {
  now?: () => number;
  windowMs?: number;
  maxAttempts?: number;
  maxKeys?: number;
}): { consume(key: string): RateLimitResult };
export const logisticsQuoteRateLimiter: {
  consume(key: string): RateLimitResult;
};
