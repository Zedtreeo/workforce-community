import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { LoggerService } from '../logger';

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory LRU cache with TTL support.
 *
 * - Tenant-scoped keys: always prefix with `tenant:{tenantId}:`
 * - TTL in seconds (default 60s)
 * - Max 2000 entries with LRU eviction
 * - Pattern-based invalidation for cache busting
 *
 * Swap to Redis later by implementing the same interface.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly store = new Map<string, CacheEntry>();
  private readonly maxSize: number = 2000;
  private readonly defaultTtl: number = 60; // seconds
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(private readonly logger: LoggerService) {
    // Sweep expired entries every 30s
    this.cleanupInterval = setInterval(() => this.sweep(), 30_000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }

  /**
   * Build a tenant-scoped cache key.
   */
  key(tenantId: string, ...parts: string[]): string {
    return `tenant:${tenantId}:${parts.join(':')}`;
  }

  /**
   * Get a cached value. Returns undefined if not found or expired.
   */
  get<T = unknown>(cacheKey: string): T | undefined {
    const entry = this.store.get(cacheKey);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(cacheKey);
      return undefined;
    }

    // LRU: move to end (most recently used)
    this.store.delete(cacheKey);
    this.store.set(cacheKey, entry);

    return entry.value as T;
  }

  /**
   * Set a cached value with TTL (in seconds).
   */
  set<T = unknown>(cacheKey: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ?? this.defaultTtl;

    // Evict oldest if at capacity
    if (this.store.size >= this.maxSize && !this.store.has(cacheKey)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
      }
    }

    this.store.set(cacheKey, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  /**
   * Get or set — returns cached value, or calls factory and caches the result.
   */
  async getOrSet<T>(
    cacheKey: string,
    factory: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = this.get<T>(cacheKey);
    if (cached !== undefined) {
      this.logger.debug(`Cache HIT: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache MISS: ${cacheKey}`);
    const value = await factory();
    this.set(cacheKey, value, ttlSeconds);
    return value;
  }

  /**
   * Delete a specific cache key.
   */
  del(cacheKey: string): boolean {
    return this.store.delete(cacheKey);
  }

  /**
   * Invalidate all keys matching a prefix.
   * Example: invalidateByPrefix('tenant:abc123:dashboard') clears all dashboard caches for that tenant.
   */
  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    if (count > 0) {
      this.logger.debug(`Cache invalidated ${count} keys with prefix: ${prefix}`);
    }
    return count;
  }

  /**
   * Invalidate all caches for a tenant.
   */
  invalidateTenant(tenantId: string): number {
    return this.invalidateByPrefix(`tenant:${tenantId}:`);
  }

  /**
   * Get cache stats for monitoring.
   */
  stats(): { size: number; maxSize: number } {
    return { size: this.store.size, maxSize: this.maxSize };
  }

  /**
   * Remove all expired entries.
   */
  private sweep(): void {
    const now = Date.now();
    let swept = 0;
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        swept++;
      }
    }
    if (swept > 0) {
      this.logger.debug(`Cache sweep: removed ${swept} expired entries`);
    }
  }
}
