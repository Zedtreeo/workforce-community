import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the current user from the request.
 * Usage: @CurrentUser() user: any
 * Usage: @CurrentUser('tenantId') tenantId: string
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
