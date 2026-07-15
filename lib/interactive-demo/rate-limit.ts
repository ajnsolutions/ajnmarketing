/**
 * Simple in-memory sliding-window rate limiter for anonymous public demo traffic.
 * Suitable for single-node / serverless warm instances; not a distributed limiter.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): RateLimitResult {
  const now = options.now ?? Date.now();
  const windowStart = now - options.windowMs;
  const existing = buckets.get(options.key) ?? { timestamps: [] };
  const timestamps = existing.timestamps.filter((ts) => ts > windowStart);

  if (timestamps.length >= options.limit) {
    buckets.set(options.key, { timestamps });
    const oldest = timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + options.windowMs - now) / 1000),
    );
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  timestamps.push(now);
  buckets.set(options.key, { timestamps });
  return {
    allowed: true,
    remaining: Math.max(0, options.limit - timestamps.length),
    retryAfterSeconds: 0,
  };
}

/** Test helper — clears all buckets. */
export function resetRateLimitBuckets(): void {
  buckets.clear();
}
