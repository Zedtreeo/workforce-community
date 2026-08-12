import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '-';
    const correlationId =
      (request.headers['x-correlation-id'] as string) || '-';
    const tenantId =
      ((request as unknown as Record<string, unknown>).tenantId as string) || '-';
    const userId =
      ((request as unknown as Record<string, unknown>).userId as string) || '-';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = ctx.getResponse<Response>();
          const duration = Date.now() - startTime;

          this.logger.log({
            method,
            url,
            statusCode: response.statusCode,
            duration: `${duration}ms`,
            correlationId,
            tenantId,
            userId,
            ip,
            userAgent,
          });
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const statusCode = err?.status || err?.statusCode || 500;

          this.logger.warn({
            method,
            url,
            statusCode,
            duration: `${duration}ms`,
            correlationId,
            tenantId,
            userId,
            ip,
            userAgent,
            error: err?.message,
          });
        },
      }),
    );
  }
}
