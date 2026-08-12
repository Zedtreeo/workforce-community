import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Generates a unique correlation ID for every inbound request.
 * If the client sends `X-Correlation-Id`, it's reused (useful for
 * distributed tracing across services). Otherwise a new UUID is created.
 *
 * The ID is attached to both the request and response headers so
 * downstream logs, exception filters, and the client can all reference
 * the same trace.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers['x-correlation-id'] as string | undefined;
    const correlationId = incoming || randomUUID();

    // Normalise on the request so every downstream consumer reads the same key
    req.headers['x-correlation-id'] = correlationId;

    // Echo back to caller
    res.setHeader('X-Correlation-Id', correlationId);

    next();
  }
}
