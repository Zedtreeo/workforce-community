import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';

/**
 * Strips dangerous HTML/script tags from all string values in request body,
 * query, and params. Defence-in-depth against stored XSS.
 *
 * Runs BEFORE ValidationPipe so class-validator sees clean data.
 */
@Injectable()
  export class SanitizeInterceptor implements NestInterceptor {
    /**
     * Tags and patterns that are never legitimate in HRMS text fields.
     * We strip them rather than encoding because the API is JSON-only —
     * HTML entities would just be noise in database records.
     */
  private static readonly DANGEROUS_PATTERNS: RegExp[] = [
        // Script tags and event handlers
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /<\/script>/gi,
        // Event handlers in attributes
        /\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi,
        // javascript: and data: protocol URIs
        /javascript\s*:/gi,
        /data\s*:\s*text\/html/gi,
        // HTML tags that can execute code
        /<(iframe|object|embed|form|input|button|textarea|select|link|meta|base|applet)\b[^>]*\/?>/gi,
        // CSS expressions
        /expression\s*\(/gi,
        /url\s*\(\s*['"]?\s*javascript/gi,
      ];

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest<Request>();

      // Sanitize body — direct assignment works (body is a plain property)
      if (request.body && typeof request.body === 'object') {
              request.body = this.sanitizeObject(request.body);
      }

      // Sanitize query — CANNOT reassign req.query (getter-only in Express).
      // Instead, mutate each value in-place.
      if (request.query && typeof request.query === 'object') {
              this.sanitizeObjectInPlace(request.query as Record<string, unknown>);
      }

      // Sanitize params — same getter-only issue as query.
      if (request.params && typeof request.params === 'object') {
              this.sanitizeObjectInPlace(request.params as Record<string, unknown>);
      }

      return next.handle();
}

  /**
     * Mutates object values in-place (for getter-only properties like req.query/req.params).
     */
  private sanitizeObjectInPlace(obj: Record<string, unknown>): void {
        for (const key of Object.keys(obj)) {
                const value = obj[key];
                if (typeof value === 'string') {
                          obj[key] = this.sanitizeString(value);
                } else if (value && typeof value === 'object') {
                          obj[key] = this.sanitizeObject(value);
                }
        }
  }

  private sanitizeObject<T>(obj: T): T {
        if (obj === null || obj === undefined) return obj;

      if (typeof obj === 'string') {
              return this.sanitizeString(obj) as unknown as T;
      }

      if (Array.isArray(obj)) {
              return obj.map((item) => this.sanitizeObject(item)) as unknown as T;
      }

      if (typeof obj === 'object') {
              const sanitized: Record<string, unknown> = {};
              for (const [key, value] of Object.entries(obj)) {
                        sanitized[key] = this.sanitizeObject(value);
              }
              return sanitized as T;
      }

      return obj;
  }

  private sanitizeString(value: string): string {
        let result = value;
        for (const pattern of SanitizeInterceptor.DANGEROUS_PATTERNS) {
                result = result.replace(pattern, '');
        }
        // Collapse any leftover HTML tags (but allow < > in text like "salary < 50000")
      // Only strip tags that look like real HTML elements
      result = result.replace(/<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^>]*)?\/?>/g, '');
        return result.trim();
  }
}
