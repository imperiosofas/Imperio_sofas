/**
 * Best-effort process-local abuse guard only. A Map is not shared across
 * instances and must never be treated as authorization or a cross-instance
 * security boundary; durable idempotency and server/database validation do
 * the correctness work.
 */
export function createQuoteRateLimiter({
  now = Date.now,
  windowMs = 10 * 60 * 1000,
  maxAttempts = 3,
  maxKeys = 5000,
} = {}) {
  const buckets = new Map();

  return {
    consume(key) {
      const timestamp = now();
      const current = buckets.get(key);
      if (!current || current.resetAt <= timestamp) {
        if (buckets.size >= maxKeys) {
          for (const [bucketKey, bucket] of buckets) {
            if (bucket.resetAt <= timestamp) buckets.delete(bucketKey);
          }
        }
        if (buckets.size >= maxKeys) {
          return {
            allowed: false,
            retryAfterSeconds: Math.ceil(windowMs / 1000),
          };
        }
        buckets.set(key, { count: 1, resetAt: timestamp + windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      if (current.count >= maxAttempts) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((current.resetAt - timestamp) / 1000),
          ),
        };
      }

      current.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

export const logisticsQuoteRateLimiter = createQuoteRateLimiter();
