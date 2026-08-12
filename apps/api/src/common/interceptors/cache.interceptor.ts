import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, tap } from 'rxjs';
import { CacheService } from '../cache';
import {
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
  CACHE_EVICT_METADATA,
} from '../decorators/cache.decorator';

/**
 * Interceptor that handles @Cacheable and @CacheEvict decorators.
 *
 * For @Cacheable: checks cache before executing handler, stores result on miss.
 * For @CacheEvict: runs handler first, then invalidates matching cache prefixes.
 *
 * Tenant ID is extracted from req.user.tenantId (set by auth guard).
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cache: CacheService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request?.user?.tenantId;
    if (!tenantId) return next.handle();

    const handler = context.getHandler();

    // Check for @CacheEvict
    const evictPrefixes = this.reflector.get<string[]>(CACHE_EVICT_METADATA, handler);
    if (evictPrefixes?.length) {
      return next.handle().pipe(
        tap(() => {
          for (const prefix of evictPrefixes) {
            this.cache.invalidateByPrefix(this.cache.key(tenantId, prefix));
          }
        }),
      );
    }

    // Check for @Cacheable
    const keyPattern = this.reflector.get<string>(CACHE_KEY_METADATA, handler);
    if (!keyPattern) return next.handle();

    const ttl = this.reflector.get<number>(CACHE_TTL_METADATA, handler) ?? 60;

    // Build full cache key including query params for uniqueness
    const query = request.query ?? {};
    const queryHash = Object.keys(query).length
      ? ':' + Object.entries(query).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&')
      : '';
    const cacheKey = this.cache.key(tenantId, keyPattern + queryHash);

    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      return of(cached);
    }

    return next.handle().pipe(
      tap((data) => {
        this.cache.set(cacheKey, data, ttl);
      }),
    );
  }
}
