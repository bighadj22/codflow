export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key using Cloudflare KV
 * @param env Cloudflare environment bindings (must include RATE_LIMIT_KV)
 * @param key Unique identifier for the rate limit (e.g., "password-reset:user@example.com")
 * @param limit Maximum number of requests allowed in the window
 * @param windowSeconds Time window in seconds
 * @returns Rate limit result with allowed status, remaining count, and reset timestamp
 */
export async function checkRateLimit(
  env: { RATE_LIMIT_KV: KVNamespace },
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / (windowSeconds * 1000))}`;
  
  console.log("Rate limit check starting", {
    timestamp: new Date().toISOString(),
    key: hashKey(key),
    windowKey: hashKey(windowKey),
    limit,
    windowSeconds,
    hasKV: !!env.RATE_LIMIT_KV,
  });
  
  try {
    // Check if KV binding exists
    if (!env.RATE_LIMIT_KV) {
      console.error("RATE_LIMIT_KV binding is missing!", {
        timestamp: new Date().toISOString(),
        env: Object.keys(env),
      });
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: now + windowSeconds * 1000,
      };
    }
    
    console.log("Attempting KV read", {
      timestamp: new Date().toISOString(),
      windowKey: hashKey(windowKey),
    });
    
    // Get current count from KV
    const current = await env.RATE_LIMIT_KV.get(windowKey);
    const count = current ? parseInt(current, 10) : 0;
    
    console.log("KV read successful", {
      timestamp: new Date().toISOString(),
      windowKey: hashKey(windowKey),
      currentValue: current,
      parsedCount: count,
    });
    
    // Calculate reset time
    const resetAt = Math.ceil(now / (windowSeconds * 1000)) * windowSeconds * 1000;
    
    // CRITICAL: Increment FIRST, then check
    // This prevents the race condition where count=2, we check (2<3), then write 3
    // Now: count=2, we write 3, then check (3>=3) and block correctly
    const newCount = count + 1;
    
    console.log("Attempting KV write", {
      timestamp: new Date().toISOString(),
      windowKey: hashKey(windowKey),
      newCount,
      expirationTtl: windowSeconds,
    });
    
    // Write the incremented count immediately
    await env.RATE_LIMIT_KV.put(
      windowKey,
      String(newCount),
      { expirationTtl: windowSeconds }
    );
    
    console.log("KV write successful", {
      timestamp: new Date().toISOString(),
      windowKey: hashKey(windowKey),
      newCount,
    });
    
    // Check if limit exceeded AFTER incrementing
    if (newCount > limit) {
      console.warn("Rate limit exceeded", {
        timestamp: new Date().toISOString(),
        key: hashKey(key),
        count: newCount,
        limit,
        resetAt: new Date(resetAt).toISOString(),
      });
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }
    
    console.log("Rate limit check passed", {
      timestamp: new Date().toISOString(),
      key: hashKey(key),
      count: newCount,
      limit,
      remaining: limit - newCount,
    });
    
    return {
      allowed: true,
      remaining: limit - newCount,
      resetAt,
    };
  } catch (error) {
    // On error, allow the request but log the issue
    console.error("Rate limit check failed", {
      timestamp: new Date().toISOString(),
      key: hashKey(key),
      windowKey: hashKey(windowKey),
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      errorName: error instanceof Error ? error.name : undefined,
    });
    
    // Fail open - allow the request if KV is unavailable
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + windowSeconds * 1000,
    };
  }
}

/**
 * Hash key for logging (privacy protection)
 * @param key Key to hash
 * @returns Hashed key
 */
function hashKey(key: string): string {
  // Simple hash for logging - shows prefix and hashes the rest
  const parts = key.split(":");
  if (parts.length < 2) return "invalid-key";
  
  const prefix = parts[0];
  const identifier = parts.slice(1).join(":");
  
  // Show first 3 chars and last char of identifier
  if (identifier.length <= 4) {
    return `${prefix}:${identifier[0]}***`;
  }
  
  return `${prefix}:${identifier.slice(0, 3)}***${identifier.slice(-1)}`;
}

/**
 * Format rate limit error message with time remaining
 * @param resetAt Reset timestamp in milliseconds
 * @returns User-friendly error message
 */
export function formatRateLimitError(resetAt: number): string {
  const now = Date.now();
  const remainingMs = resetAt - now;
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  
  if (remainingMinutes <= 1) {
    return "Too many requests. Please try again in a moment.";
  }
  
  return `Too many requests. Please try again in ${remainingMinutes} minutes.`;
}
