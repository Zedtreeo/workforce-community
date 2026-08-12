import {
  Controller, Get, Post, Body, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AuditLogQueryDto, BulkImportDto } from './dto';

@Controller('audit')
@ApiTags('Audit & Bulk Ops')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'View audit logs' })
  @ApiResponse({ status: 200, description: 'Audit logs returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  getLogs(@Req() req: any, @Query() query: AuditLogQueryDto) {
    return this.auditService.getLogs(req.tenantId, {
      entity: query.entity,
      action: query.action,
      page: query.page ? +query.page : undefined,
      limit: query.limit ? +query.limit : undefined,
    });
  }

  @Post('employees/import')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk import employees from JSON array' })
  @ApiResponse({ status: 201, description: 'Employees bulk-imported' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  bulkImport(@Req() req: any, @Body() body: BulkImportDto) {
    return this.auditService.bulkImportEmployees(req.tenantId, body.rows, req.user.id);
  }

  @Get('employees/export')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Export all employees as JSON (for CSV)' })
  @ApiResponse({ status: 200, description: 'All employees exported as JSON' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  async exportEmployees(@Req() req: any) {
    return this.auditService.exportEmployees(req.tenantId);
  }
}
