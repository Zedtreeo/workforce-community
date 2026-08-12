import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';

interface LockoutRecord {
  failedAttempts: number;
  lockedUntil: number | null;
  lastAttempt: number;
}

/**
 * Account lockout guard — tracks failed login attempts by email+IP.
 *
 * Rules:
 * - 5 failed attempts → 15 minute lockout
 * - 10 failed attempts → 1 hour lockout
 * - 20+ failed attempts → 24 hour lockout (possible brute force)
 *
 * Call `recordFailure()` from the auth flow on bad credentials.
 * Call `recordSuccess()` on successful login to reset the counter.
 *
 * Production upgrade path: move to Redis for multi-instance support.
 */
@Injectable()
export class AccountLockoutGuard implements CanActivate {
  private readonly logger = new Logger(AccountLockoutGuard.name);
  private readonly store = new Map<string, LockoutRecord>();

  private readonly thresholds = [
    { attempts: 5, lockoutMinutes: 15 },
    { attempts: 10, lockoutMinutes: 60 },
    { attempts: 20, lockoutMinutes: 1440 }, // 24 hours
  ];

  /** Cleanup stale entries every 30 minutes */
  private lastCleanup = Date.now();
  private readonly cleanupInterval = 30 * 60 * 1000;
  private readonly staleAfter = 24 * 60 * 60 * 1000; // 24h

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as Record<string, unknown>;
    const email = (body?.email as string)?.toLowerCase();

    if (!email) return true; // Not a login attempt

    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const key = `${email}:${ip}`;
    const now = Date.now();

    // Periodic cleanup
    if (now - this.lastCleanup > this.cleanupInterval) {
      this.cleanup(now);
      this.lastCleanup = now;
    }

    const record = this.store.get(key);
    if (!record) return true;

    if (record.lockedUntil && now < record.lockedUntil) {
      const remainingMin = Math.ceil((record.lockedUntil - now) / 60000);

      this.logger.warn({
        email,
        ip,
        failedAttempts: record.failedAttempts,
        lockedUntilMin: remainingMin,
        message: 'Account locked — too many failed attempts',
      });

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Account Locked',
          message: `Too many failed login attempts. Account is locked for ${remainingMin} minute(s). Please try again later.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Lockout expired — allow through but keep the counter
    return true;
  }

  /**
   * Call on failed login attempt.
   */
  recordFailure(email: string, ip: string): void {
    const key = `${email.toLowerCase()}:${ip}`;
    const now = Date.now();

    const record = this.store.get(key) || {
      failedAttempts: 0,
      lockedUntil: null,
      lastAttempt: now,
    };

    record.failedAttempts++;
    record.lastAttempt = now;

    // Determine lockout duration
    let lockoutMinutes = 0;
    for (const threshold of this.thresholds) {
      if (record.failedAttempts >= threshold.attempts) {
        lockoutMinutes = threshold.lockoutMinutes;
      }
    }

    if (lockoutMinutes > 0) {
      record.lockedUntil = now + lockoutMinutes * 60 * 1000;
      this.logger.warn({
        email,
        ip,
        failedAttempts: record.failedAttempts,
        lockoutMinutes,
        message: 'Account locked after repeated failures',
      });
    }

    this.store.set(key, record);
  }

  /**
   * Call on successful login — resets the counter.
   */
  recordSuccess(email: string, ip: string): void {
    const key = `${email.toLowerCase()}:${ip}`;
    this.store.delete(key);
  }

  private cleanup(now: number) {
    for (const [key, record] of this.store) {
      if (now - record.lastAttempt > this.staleAfter) {
        this.store.delete(key);
      }
    }
  }
}
