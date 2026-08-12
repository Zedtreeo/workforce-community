import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  code?: string;
  correlationId?: string;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId =
      (request.headers['x-correlation-id'] as string) || undefined;

    let statusCode: number;
    let message: string | string[];
    let error: string;
    let code: string | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'string') {
        message = exResponse;
        error = HttpStatus[statusCode] || 'Error';
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        const res = exResponse as Record<string, unknown>;
        message = (res.message as string | string[]) || exception.message;
        error = (res.error as string) || HttpStatus[statusCode] || 'Error';
      } else {
        message = exception.message;
        error = HttpStatus[statusCode] || 'Error';
      }

      // 4xx = warn, 5xx would be caught below
      if (statusCode >= 400 && statusCode < 500) {
        this.logger.warn(
          {
            statusCode,
            path: request.url,
            method: request.method,
            correlationId,
            message,
          },
          `Client error: ${request.method} ${request.url}`,
        );
      }
    } else if (process.env.DEMO_MODE === 'true' && this.isPermissionDenied(exception)) {
      // Demo read-only: the demo DB role (demo_readonly) has no write grant on
      // business tables, so any mutation hits Postgres "permission denied"
      // (SQLSTATE 42501). Translate that into a friendly, recognisable response
      // instead of a raw 500 — the web turns code DEMO_READ_ONLY into a toast.
      statusCode = HttpStatus.FORBIDDEN;
      error = 'Forbidden';
      message = 'This is a read-only demo — your changes were not saved.';
      code = 'DEMO_READ_ONLY';
      this.logger.warn(
        { path: request.url, method: request.method, correlationId },
        `Demo read-only: blocked ${request.method} ${request.url}`,
      );
    } else {
      // Unhandled / unknown exception → 500
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      error = 'Internal Server Error';
      message = 'An unexpected error occurred';

      // Serialize Error properly (Error properties are non-enumerable, JSON.stringify produces {})
      const errorDetail = exception instanceof Error
        ? { name: exception.name, message: exception.message, stack: exception.stack }
        : { message: String(exception) };

      this.logger.error(
        {
          err: errorDetail,
          path: request.url,
          method: request.method,
          correlationId,
        },
        `Unhandled exception: ${request.method} ${request.url}`,
      );
    }

    const body: ErrorResponse = {
      statusCode,
      error,
      message,
      ...(code && { code }),
      ...(correlationId && { correlationId }),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(body);
  }

  /** Detect a Postgres "permission denied" (SQLSTATE 42501), however Prisma wrapped it. */
  private isPermissionDenied(exception: unknown): boolean {
    const ex = exception as any;
    if (ex?.code === '42501' || ex?.meta?.code === '42501') return true;
    const msg = exception instanceof Error ? exception.message : String(exception ?? '');
    return /permission denied/i.test(msg);
  }
}
