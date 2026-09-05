import { redis } from '@/lib/redis';

// Fixed-window counter. Returns whether the caller is still under the limit
// - check before doing the sensitive work, call recordFailure() after an
// actual failure, and reset() after a genuine success.
export async function isRateLimited(key: string, limit: number): Promise<boolean> {
  const current = await redis.get(key);
  return current !== null && parseInt(current, 10) >= limit;
}

export async function recordFailure(key: string, windowSeconds: number): Promise<void> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
}

export async function resetRateLimit(key: string): Promise<void> {
  await redis.del(key);
}
