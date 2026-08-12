import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { auth } from '../../auth/auth.config';
import { fromNodeHeaders } from 'better-auth/node';
import { PrismaClient } from '@prisma/client';
import { getModuleScopes, isApiPathAllowed } from '../config/module-scopes';

const prisma = new PrismaClient();

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Try 1: Better Auth cookie-based session (web portal)
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (session) {
      request.user = session.user;
      request.session = session.session;
      await assertApprovedIfEmployee(session.user);
      await assertModuleAllowed(session.user, request);
      return true;
    }

    // Try 2: Bearer token (desktop agent)
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const dbSession = await prisma.session.findFirst({
        where: {
          token,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (dbSession) {
        request.user = dbSession.user;
        request.session = dbSession;
        await assertApprovedIfEmployee(dbSession.user);
        await assertModuleAllowed(dbSession.user, request);
        return true;
      }
    }

    throw new UnauthorizedException('Invalid or expired session');
  }
}



/**
 * Block API access if the authenticated user maps to an employee
 * whose approval_status is not APPROVED. Admin/Manager-only users
 * (no employee row matching their email) pass through.
 */
/**
 * Enforce per-user module scopes (users.module_scopes). Users with no
 * scopes configured (the default) are unaffected.
 */
async function assertModuleAllowed(user: any, request: any) {
  if (!user?.id) return;
  const scopes = await getModuleScopes(user.id);
  request.moduleScopes = scopes;
  if (!isApiPathAllowed(scopes, request.path ?? request.url ?? '')) {
    throw new ForbiddenException('This module is not enabled for your account.');
  }
}

async function assertApprovedIfEmployee(user: any) {
  if (!user?.email || !user?.tenantId) return;
  const emp = await prisma.employee.findFirst({
    where: { tenantId: user.tenantId, email: user.email, deletedAt: null },
    select: { approvalStatus: true, status: true, firstName: true },
  });
  if (!emp) return; // not an employee (admin user)
  if ((emp as any).approvalStatus !== 'APPROVED') {
    throw new ForbiddenException(
      `Your account is pending HR approval (status: ${(emp as any).approvalStatus}). You will receive an email when approved.`,
    );
  }
}
