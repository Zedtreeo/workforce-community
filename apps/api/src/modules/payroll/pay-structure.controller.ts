import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { PayStructureService } from './pay-structure.service';
import { CreatePayHeadDto, UpdatePayHeadDto } from './dto/pay-head.dto';
import {
  CreatePayStructureDto, UpdatePayStructureDto, AssignPayStructureDto,
  ValidateFormulaDto, PreviewCalculationDto,
} from './dto/pay-structure.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('pay-structure')
@ApiTags('Pay Structure')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
export class PayStructureController {
  constructor(private readonly payStructureService: PayStructureService) {}

  // ── Pay Heads ─────────────────────────────────────

  @Get('heads')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all pay heads for tenant' })
  @ApiQuery({ name: 'type', required: false, enum: ['EARNING', 'DEDUCTION'] })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of pay heads' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getPayHeads(
    @Req() req: any,
    @Query('type') type?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.payStructureService.getPayHeads(req.tenantId, {
      type,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get('heads/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get pay head by ID' })
  @ApiResponse({ status: 200, description: 'Pay head details' })
  getPayHead(@Req() req: any, @Param('id') id: string) {
    return this.payStructureService.getPayHead(req.tenantId, id);
  }

  @Post('heads')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new pay head' })
  @ApiResponse({ status: 201, description: 'Pay head created' })
  createPayHead(@Req() req: any, @Body() dto: CreatePayHeadDto) {
    return this.payStructureService.createPayHead(req.tenantId, dto);
  }

  @Patch('heads/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a pay head' })
  @ApiResponse({ status: 200, description: 'Pay head updated' })
  updatePayHead(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePayHeadDto) {
    return this.payStructureService.updatePayHead(req.tenantId, id, dto);
  }

  @Delete('heads/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a pay head (only if unused)' })
  @ApiResponse({ status: 200, description: 'Pay head deleted' })
  deletePayHead(@Req() req: any, @Param('id') id: string) {
    return this.payStructureService.deletePayHead(req.tenantId, id);
  }

  // ── Pay Structure Templates ───────────────────────

  @Get('templates')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all pay structure templates' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of pay structures with components' })
  getPayStructures(@Req() req: any, @Query('isActive') isActive?: string) {
    return this.payStructureService.getPayStructures(req.tenantId, {
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get('templates/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get pay structure template with components and assignments' })
  @ApiResponse({ status: 200, description: 'Pay structure details' })
  getPayStructure(@Req() req: any, @Param('id') id: string) {
    return this.payStructureService.getPayStructure(req.tenantId, id);
  }

  @Post('templates')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new pay structure template' })
  @ApiResponse({ status: 201, description: 'Pay structure created' })
  createPayStructure(@Req() req: any, @Body() dto: CreatePayStructureDto) {
    return this.payStructureService.createPayStructure(req.tenantId, dto);
  }

  @Patch('templates/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update pay structure template and/or components' })
  @ApiResponse({ status: 200, description: 'Pay structure updated' })
  updatePayStructure(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePayStructureDto) {
    return this.payStructureService.updatePayStructure(req.tenantId, id, dto);
  }

  @Delete('templates/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete pay structure (only if no active assignments)' })
  @ApiResponse({ status: 200, description: 'Pay structure deleted' })
  deletePayStructure(@Req() req: any, @Param('id') id: string) {
    return this.payStructureService.deletePayStructure(req.tenantId, id);
  }

  // ── Assignments ───────────────────────────────────

  @Get('assignments')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List pay structure assignments' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of assignments' })
  getAssignments(
    @Req() req: any,
    @Query('employeeId') employeeId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.payStructureService.getAssignments(req.tenantId, {
      employeeId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Post('assignments')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign pay structure to employee' })
  @ApiResponse({ status: 201, description: 'Assignment created' })
  assignPayStructure(@Req() req: any, @Body() dto: AssignPayStructureDto) {
    return this.payStructureService.assignPayStructure(req.tenantId, dto);
  }

  // ── Formula Tools ─────────────────────────────────

  @Post('validate-formula')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Validate a formula expression' })
  @ApiResponse({ status: 200, description: 'Validation result: { valid, error? }' })
  validateFormula(@Req() req: any, @Body() dto: ValidateFormulaDto) {
    return this.payStructureService.validateFormula(req.tenantId, dto.formula, dto.availableHeadCodes);
  }

  @Post('preview')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Preview pay calculation for a template + CTC' })
  @ApiResponse({ status: 200, description: 'Calculated breakdown' })
  previewCalculation(@Req() req: any, @Body() dto: PreviewCalculationDto) {
    return this.payStructureService.previewCalculation(req.tenantId, dto);
  }

  @Get('templates/:id/dependencies')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get formula dependency graph for a template' })
  @ApiResponse({ status: 200, description: 'Dependency graph' })
  getDependencyGraph(@Req() req: any, @Param('id') id: string) {
    return this.payStructureService.getDependencyGraph(req.tenantId, id);
  }

  // ── Seed Defaults ─────────────────────────────────

  @Post('seed-india')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Seed default Indian pay heads and structure' })
  @ApiResponse({ status: 201, description: 'Default Indian pay structure created' })
  seedIndiaDefaults(@Req() req: any) {
    return this.payStructureService.seedIndiaDefaults(req.tenantId);
  }
}
