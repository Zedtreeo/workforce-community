import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

/**
 * Guard for client portal endpoints.
 * Verifies JWT token with type: 'client-portal' and sets req.portalUser.
 */
@Injectable()
export class ClientPortalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token');
    }

    try {
      const token = authHeader.split(' ')[1];
      const secret = process.env.BETTER_AUTH_SECRET;
      if (!secret) {
        throw new UnauthorizedException('Server authentication not configured');
      }
      const payload = jwt.verify(token, secret) as any;

      if (payload.type !== 'client-portal') {
        throw new UnauthorizedException('Invalid token type');
      }

      req.portalUser = {
        id: payload.sub,
        clientId: payload.clientId,
        tenantId: payload.tenantId,
      };

      return true;
    } catch (e: any) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
