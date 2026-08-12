import {
  Controller, Get, Post,
  Param, Query, Req, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { NotificationsQueryDto } from './dto';

@Controller('notifications')
@ApiTags('Notifications')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard, TenantGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user' })
  @ApiResponse({ status: 200, description: 'Paginated notifications for current user returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getNotifications(@Req() req: any, @Query() query: NotificationsQueryDto) {
    return this.notificationsService.getForUser(req.tenantId, req.user.id, {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      unreadOnly: query.unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread notification count returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getUnreadCount(@Req() req: any) {
    return this.notificationsService.getUnreadCount(req.tenantId, req.user.id);
  }

  @Post(':id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.markRead(req.tenantId, req.user.id, id);
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.tenantId, req.user.id);
  }
}
