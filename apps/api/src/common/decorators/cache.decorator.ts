import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for cache configuration on controller methods.
 */
export const CACHE_KEY_METADATA = 'cache:key';
export const CACHE_TTL_METADATA = 'cache:ttl';
export const CACHE_EVICT_METADATA = 'cache:evict';

/**
 * @Cacheable — caches the return value of a controller/service method.
 *
 * Usage:
 * ```ts
 * @Cacheable('dashboard:stats', 60)
 * async getStats(@TenantId() tenantId: string) { ... }
 * ```
 *
 * The cache key is automatically prefixed with `tenant:{tenantId}:`.
 * Requires CacheInterceptor on the controller or globally.
 */
export const Cacheable = (keyPattern: string, ttlSeconds = 60) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_KEY_METADATA, keyPattern)(target, propertyKey, descriptor);
    SetMetadata(CACHE_TTL_METADATA, ttlSeconds)(target, propertyKey, descriptor);
    return descriptor;
  };
};

/**
 * @CacheEvict — invalidates cache entries matching a prefix after the method executes.
 *
 * Usage:
 * ```ts
 * @CacheEvict('dashboard:stats')
 * async updateStats(@TenantId() tenantId: string, ...) { ... }
 * ```
 *
 * Clears all keys matching `tenant:{tenantId}:{prefix}`.
 */
export const CacheEvict = (...prefixes: string[]) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_EVICT_METADATA, prefixes)(target, propertyKey, descriptor);
    return descriptor;
  };
};
