/**
 * Advanced rate limiting implementation for high traffic scenarios
 * This implementation is designed to prevent API abuse while still allowing
 * legitimate users to vote multiple times for the same or different candidates
 */

interface RateLimitOptions {
  // Maximum requests per window
  limit: number;
  // Window size in milliseconds
  windowMs: number;
  // Burst allowance (extra requests allowed in short bursts)
  burstLimit?: number;
  // Time to extend window after burst in milliseconds
  burstWindowExtension?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  burst?: {
    count: number;
    resetTime: number;
  };
}

export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  public options: RateLimitOptions;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: RateLimitOptions) {
    this.options = {
      limit: options.limit || 60,
      windowMs: options.windowMs || 60 * 1000,
      burstLimit: options.burstLimit || Math.floor(options.limit * 0.5),
      burstWindowExtension: options.burstWindowExtension || 10 * 1000,
    };

    // Start cleanup interval (if in browser/Node environment)
    if (typeof setInterval === 'function') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 
        Math.min(this.options.windowMs, 60 * 1000)); // Cleanup at most once per minute
    }
  }

  /**
   * Check if a key is rate limited
   * @param key The key to check (typically IP address or some identifier)
   * @returns Object indicating if request is allowed and remaining requests
   */
  check(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    let entry = this.store.get(key);

    // If no entry exists or entry has expired, create new entry
    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 1,
        resetTime: now + this.options.windowMs,
        burst: {
          count: 0,
          resetTime: now + this.options.windowMs,
        },
      };
      this.store.set(key, entry);
      return { allowed: true, remaining: this.options.limit - 1, resetTime: entry.resetTime };
    }

    // Check if under normal limit
    if (entry.count < this.options.limit) {
      entry.count++;
      return { allowed: true, remaining: this.options.limit - entry.count, resetTime: entry.resetTime };
    }

    // If over normal limit, check burst limit
    if (entry.burst && entry.burst.count < this.options.burstLimit!) {
      entry.burst.count++;
      // Extend reset time for normal rate limiting if using burst
      entry.resetTime = Math.max(entry.resetTime, now + this.options.burstWindowExtension!);
      return { 
        allowed: true, 
        remaining: 0, 
        resetTime: entry.resetTime 
      };
    }

    // Rate limited
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  /**
   * Remove expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Destroy the rate limiter and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Default rate limiter instances for different API endpoints
export const apiRateLimiter = new RateLimiter({
  limit: 100,         // 100 requests per minute normally
  windowMs: 60 * 1000, // 1 minute window
  burstLimit: 50,      // Extra 50 requests allowed in bursts
});

// Special high-throughput rate limiter for voting endpoints
// Allows more requests to ensure users can vote multiple times
export const voteRateLimiter = new RateLimiter({
  limit: 300,         // 300 requests per minute normally (5 per second)
  windowMs: 60 * 1000, // 1 minute window
  burstLimit: 150,     // Extra 150 requests allowed in bursts
});

export default {
  apiRateLimiter,
  voteRateLimiter,
  RateLimiter
};
