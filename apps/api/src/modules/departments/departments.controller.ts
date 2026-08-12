import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('departments')
@ApiTags('Departments')
@UseGuards(AuthGuard, TenantGuard)
@ApiBearerAuth('bearer')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create department' })
  @ApiResponse({ status: 201, description: 'Newly created department record' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Req() req: any, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(req.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List departments' })
  @ApiResponse({ status: 200, description: 'Department list with pagination metadata' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.departmentsService.findAll(req.tenantId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get department by ID' })
  @ApiResponse({ status: 200, description: 'Department details with employee count' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.departmentsService.findOne(req.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update department' })
  @ApiResponse({ status: 200, description: 'Updated department record' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(req.tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete department' })
  @ApiResponse({ status: 200, description: 'Department soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Not found' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.departmentsService.remove(req.tenantId, id);
  }
}
