import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { scopeAllowsModule } from '../../common/config/module-scopes';
import { UserRole } from '@prisma/client';
import { AssignAccountManagerDto } from '../invoices/dto/invoicing.dto';
import { PrismaService } from '../../prisma';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// Client records include billing contact / payment-relevant fields. Restrict to
// MANAGER+ so MEMBER employees cannot read client data; they get only their
// client's NAME via the self-scoped /portal routes.
@Controller('clients')
@ApiTags('Clients')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
@Roles(UserRole.MANAGER)
@ApiBearerAuth('bearer')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService,
    private readonly prisma: PrismaService,) {}

  /**
   * Client billing/payment routing (billingEmail, payoneerEmail) and the
   * per-employee billingRate on embedded assignments are invoice/revenue data.
   * Roles without `invoices` scope (e.g. an attendance/roster-only profile) see
   * the client + its staff mapping but not the money. Full (null) scopes keep it.
   */
  private canSeeBilling(req: any): boolean {
    return scopeAllowsModule(req.moduleScopes ?? null, 'invoices');
  }

  private stripClientBilling<T>(client: T, canSee: boolean): T {
    if (canSee || !client || typeof client !== 'object') return client;
    const { billingEmail, payoneerEmail, assignments, ...rest } = client as any;
    if (Array.isArray(assignments)) {
      rest.assignments = assignments.map((a: any) => {
        const { billingRate, billingCycle, ...ar } = a;
        return ar;
      });
    }
    return rest as T;
  }

  @Post()
  @ApiOperation({ summary: 'Create client' })
  @ApiResponse({ status: 201, description: 'Newly created client record' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Req() req: any, @Body() dto: CreateClientDto) {
    return this.clientsService.create(req.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List clients (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Client list with pagination metadata' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const res = await this.clientsService.findAll(req.tenantId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    if (!this.canSeeBilling(req)) {
      res.data = res.data.map((c: any) => this.stripClientBilling(c, false));
    }
    return res;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get client by ID' })
  @ApiResponse({ status: 200, description: 'Client details with contact and billing info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    const client = await this.clientsService.findOne(req.tenantId, id);
    return this.stripClientBilling(client, this.canSeeBilling(req));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update client' })
  @ApiResponse({ status: 200, description: 'Updated client record' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(req.tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete client' })
  @ApiResponse({ status: 200, description: 'Client soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Not found' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.clientsService.remove(req.tenantId, id);
  }
  @Patch(':id/account-manager')
  @ApiOperation({ summary: 'Assign or clear the account manager for this client' })
  async assignAccountManager(@Req() req: any, @Param('id') id: string, @Body() dto: AssignAccountManagerDto) {
    if (dto.accountManagerId) {
      const u = await this.prisma.user.findFirst({
        where: { id: dto.accountManagerId, tenantId: req.tenantId },
        select: { id: true, role: true },
      });
      if (!u) throw new NotFoundException('User not found');
      if (!['MANAGER', 'ADMIN', 'OWNER'].includes(u.role)) {
        throw new BadRequestException('User must have MANAGER role or higher');
      }
    }
    return this.prisma.client.update({
      where: { id },
      data: { accountManagerId: dto.accountManagerId ?? null },
      select: {
        id: true, name: true,
        accountManager: { select: { id: true, name: true, email: true } },
      },
    });
  }

}
