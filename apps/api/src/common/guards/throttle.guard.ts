import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

export const THROTTLE_KEY = 'throttle';

export interface ThrottleConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  ttl: number;
}

/**
 * Decorator to override default rate limits on specific routes.
 * Use stricter limits on auth endpoints (login, register, forgot-password).
 */
export function Throttle(config: ThrottleConfig) {
  return function (
    target: object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ): void {
    if (descriptor?.value) {
      Reflect.defineMetadata(THROTTLE_KEY, config, descriptor.value);
    } else {
      Reflect.defineMetadata(THROTTLE_KEY, config, target);
    }
  };
}

interface HitRecord {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding-window rate limiter.
 *
 * Defaults: 60 requests / 60 seconds per IP.
 * Override per-route with @Throttle({ limit: 5, ttl: 60 }).
 *
 * Production upgrade path: swap the in-memory Map for Redis
 * (ioredis INCR + EXPIRE) for multi-instance deployments.
 */
@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly logger = new Logger(ThrottleGuard.name);
  private readonly store = new Map<string, HitRecord>();

  /** Default limits */
  private readonly defaultLimit = 60;
  private readonly defaultTtl = 60; // seconds

  /** Cleanup stale entries every 5 minutes */
  private lastCleanup = Date.now();
  private readonly cleanupInterval = 5 * 60 * 1000;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Read per-route config or fall back to defaults
    const config = this.reflector.getAllAndOverride<ThrottleConfig | undefined>(
      THROTTLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const limit = config?.limit ?? this.defaultLimit;
    const ttl = config?.ttl ?? this.defaultTtl;

    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const route = request.method + ':' + request.route?.path || request.url;
    const key = `${ip}:${route}`;

    const now = Date.now();

    // Periodic cleanup of expired entries
    if (now - this.lastCleanup > this.cleanupInterval) {
      this.cleanup(now);
      this.lastCleanup = now;
    }

    const record = this.store.get(key);

    if (!record || now > record.resetAt) {
      // First request or window expired → start new window
      this.store.set(key, { count: 1, resetAt: now + ttl * 1000 });
      return true;
    }

    record.count++;

    if (record.count > limit) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      this.logger.warn({
        ip,
        route,
        limit,
        ttl,
        message: `Rate limit exceeded`,
      });

      const response = context.switchToHttp().getResponse();
      response.setHeader('Retry-After', String(retryAfter));
      response.setHeader('X-RateLimit-Limit', String(limit));
      response.setHeader('X-RateLimit-Remaining', '0');
      response.setHeader('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private cleanup(now: number) {
    for (const [key, record] of this.store) {
      if (now > record.resetAt) {
        this.store.delete(key);
      }
    }
  }
}
