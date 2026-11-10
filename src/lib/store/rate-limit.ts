/**
 * VANTA GARAGE — in-memory rate limiter.
 * Sec 19.2: rate limiting on sensitive operations.
 *
 * Keys are per-identifier (IP or Telegram user ID). Counters reset after windowMs.
 * Not distributed — fine for single-instance serverless; Redis can back this later.
 */

type RateLimitEntry = {
  count: number;
  resetTime: number;
};

const store = new Map<string, RateLimitEntry>();

export function rateLimit(
  key: string,
  { maxRequests, windowMs }: { maxRequests: number; windowMs: number },
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime };
}

/** Clear an entry (used in tests / reset). */
export function rateLimitReset(key: string): void {
  store.delete(key);
}

export function rateLimitSize(): number {
  return store.size;
}
