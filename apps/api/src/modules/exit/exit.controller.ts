import {
  Controller, Get, Post, Body, Param, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ExitService } from './exit.service';
import { InitiateExitDto, SettleExitDto } from './dto/exit.dto';

@Controller('exit')
@ApiTags('Exit / Offboarding')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
@Roles(UserRole.ADMIN)
export class ExitController {
  constructor(private readonly exit: ExitService) {}

  @Get()
  @ApiOperation({ summary: 'List exits / offboardings' })
  list(@Req() req: any, @Query('status') status?: string) {
    return this.exit.list(req.tenantId, status);
  }

  @Get(':employeeId')
  @ApiOperation({ summary: 'Get the exit for an employee' })
  getOne(@Req() req: any, @Param('employeeId') employeeId: string) {
    return this.exit.getByEmployee(req.tenantId, employeeId);
  }

  @Post('initiate')
  @ApiOperation({ summary: 'Initiate an exit (resignation/termination)' })
  initiate(@Req() req: any, @Body() body: InitiateExitDto) {
    return this.exit.initiate(req.tenantId, body, req.user?.id);
  }

  @Post(':employeeId/preview-fnf')
  @ApiOperation({ summary: 'Preview the full-and-final settlement (no mutation)' })
  preview(@Req() req: any, @Param('employeeId') employeeId: string, @Body() body: SettleExitDto) {
    return this.exit.previewFnF(req.tenantId, employeeId, body.adjustments || []);
  }

  @Post(':employeeId/settle')
  @ApiOperation({ summary: 'Settle the F&F — terminates the employee + generates the statement' })
  settle(@Req() req: any, @Param('employeeId') employeeId: string, @Body() body: SettleExitDto) {
    return this.exit.settle(req.tenantId, employeeId, body, req.user?.id);
  }

  @Post(':employeeId/cancel')
  @ApiOperation({ summary: 'Cancel an in-progress exit (reactivates the employee)' })
  cancel(@Req() req: any, @Param('employeeId') employeeId: string) {
    return this.exit.cancel(req.tenantId, employeeId);
  }

  @Get(':employeeId/settlement-pdf')
  @ApiOperation({ summary: 'Download the settlement statement PDF' })
  async settlementPdf(@Req() req: any, @Param('employeeId') employeeId: string, @Res() res: Response) {
    const { buffer, fileName } = await this.exit.settlementPdf(req.tenantId, employeeId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    res.send(buffer);
  }
}
