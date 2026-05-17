/**
 * Simple in-memory rate limiter per key (e.g. user ID).
 * No external dependencies — works in serverless with caveats
 * (each cold start resets the map, which is acceptable for abuse prevention).
 */
const hits = new Map<string, { count: number; resetAt: number }>()

// Cleanup stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) hits.delete(key)
  }
}, 5 * 60 * 1000)

/**
 * Returns true if the request should be ALLOWED, false if rate-limited.
 * @param key   Unique identifier (e.g. `comment:${userId}`)
 * @param max   Maximum requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = hits.get(key)

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= max) return false

  entry.count++
  return true
}
