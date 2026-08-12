import { Injectable, CanActivate, ForbiddenException } from '@nestjs/common';

/**
 * Blocks a route entirely when the API runs in DEMO_MODE. Used to keep
 * powerful maintenance surfaces (e.g. the Troubleshoot SQL/file console) off
 * the public demo, where signups get an ADMIN role.
 */
@Injectable()
export class NotInDemoGuard implements CanActivate {
  canActivate(): boolean {
    if (process.env.DEMO_MODE === 'true') {
      throw new ForbiddenException('This feature is disabled on the demo environment');
    }
    return true;
  }
}
