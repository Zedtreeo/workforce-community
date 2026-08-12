import {
  Injectable, CanActivate, ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * TenantGuard extracts tenantId from the authenticated user
 * and attaches it to request.tenantId.
 * Must run AFTER AuthGuard.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.tenantId) {
      throw new ForbiddenException('User is not associated with any tenant');
    }

    // Set tenantId on request — services read from here, never from body/params
    request.tenantId = user.tenantId;

    return true;
  }
}
