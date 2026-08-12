import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware — zero-dependency alternative to Helmet.
 *
 * Sets all critical security headers to protect against:
 * - XSS attacks
 * - Clickjacking
 * - MIME type sniffing
 * - Information leakage
 * - Protocol downgrade attacks
 *
 * Production note: In production behind a reverse proxy (nginx/CloudFront),
 * some headers (HSTS, CSP) may be set at the edge instead.
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction) {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // XSS protection (legacy browsers)
    res.setHeader('X-XSS-Protection', '0'); // Modern recommendation: disable, rely on CSP

    // Don't leak referrer data
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Restrict browser features/APIs
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()',
    );

    // Remove server identification
    res.removeHeader('X-Powered-By');

    // Strict Transport Security (only effective over HTTPS)
    // max-age = 1 year, include subdomains
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );

    // Content Security Policy — API-appropriate (no inline scripts needed)
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'",
    );

    // Prevent caching of API responses containing sensitive data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');

    next();
  }
}
