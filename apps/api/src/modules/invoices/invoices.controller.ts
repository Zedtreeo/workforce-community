// REPLACEMENT for apps/api/src/modules/invoices/invoices.controller.ts
//
// Adds:
//   - GET    /invoices/:id/payments
//   - POST   /invoices/:id/payments
//   - DELETE /invoices/:id/payments/:paymentId
//   - PATCH  /invoices/:id/write-off
//   - POST   /invoices/:id/send-email
// Plus updates the existing update/cancel/markSent/markPaid paths to use
// InvoiceAccessHelper for account-manager-scoped writes.
//
import {
  Controller, Get, Post, Patch, Put, Delete,
  Body, Param, Query, Req, Res, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { InvoiceStatus, UserRole } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicePaymentService } from './services/invoice-payment.service';
import { InvoiceLineItemsService } from './services/invoice-line-items.service';
import { AddLineItemDto, UpdateLineItemDto } from './dto/line-items.dto';
import { InvoiceMailerService } from './services/invoice-mailer.service';
import { InvoiceAutoGenService } from './services/invoice-auto-gen.service';
import { InvoiceAccessHelper } from './services/invoice-access.helper';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { GenerateForAssignmentDto } from './dto/generate-for-assignment.dto';
import { DuplicateInvoiceDto } from './dto/duplicate-invoice.dto';
import { UpdateInvoiceEmailTemplateDto } from './dto/invoicing.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { RecordPaymentDto, WriteOffDto, SendInvoiceEmailDto } from './dto/invoicing.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// Invoices hold client payment data (amounts, payment terms, ACH/bank notes).
// Floor the whole controller at MANAGER+ so MEMBER employees can never read or
// mutate invoices; stricter per-method @Roles(ADMIN) still override this.
@Controller('invoices')
@ApiTags('Invoices')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
@Roles(UserRole.MANAGER)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly pdfService: InvoicePdfService,
    private readonly payments: InvoicePaymentService,
    private readonly lineItems: InvoiceLineItemsService,
    private readonly mailer: InvoiceMailerService,
    private readonly autoGen: InvoiceAutoGenService,
    private readonly access: InvoiceAccessHelper,
  ) {}

  // ─────────── Existing endpoints (kept) ───────────
  @Post('generate')
  @Roles(UserRole.MANAGER)          // bumped down from ADMIN; account-manager check kicks in for non-admins
  @ApiOperation({ summary: 'Generate a draft invoice from active assignments' })
  async generate(@Req() req: any, @Body() dto: GenerateInvoiceDto) {
    await this.access.assertClientWrite(req.tenantId, dto.clientId, req.user.id, req.user.role);
    return this.invoicesService.generate(req.tenantId, dto, req.user?.id);
  }

  @Post('generate-for-assignment')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Generate one advance invoice for one or more employees (assignments) of the same client' })
  async generateForAssignment(@Req() req: any, @Body() dto: GenerateForAssignmentDto) {
    const ids = [...(dto.assignmentIds ?? []), ...(dto.assignmentId ? [dto.assignmentId] : [])];
    const clientId = await this.invoicesService.getAssignmentsClientId(req.tenantId, ids);
    await this.access.assertClientWrite(req.tenantId, clientId, req.user.id, req.user.role);
    return this.invoicesService.generateForAssignment(req.tenantId, dto, req.user?.id);
  }

  @Post(':id/duplicate')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Clone an invoice into a new DRAFT (fresh number, new date/period)' })
  async duplicate(@Req() req: any, @Param('id') id: string, @Body() dto: DuplicateInvoiceDto) {
    await this.access.assertCanWrite(req.tenantId, id, req.user.id, req.user.role);
    return this.invoicesService.duplicate(req.tenantId, id, dto, req.user?.id);
  }

  @Get()
  @ApiOperation({ summary: 'List invoices' })
  findAll(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string,
          @Query('clientId') clientId?: string, @Query('status') status?: InvoiceStatus,
          @Query('year') year?: string) {
    return this.invoicesService.findAll(req.tenantId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      clientId, status, year: year ? parseInt(year, 10) : undefined,
    });
  }

  @Get('stats')
  getStats(@Req() req: any) { return this.invoicesService.getStats(req.tenantId); }

  // ─────────── Invoice email template (customisable) ───────────
  @Get('email-template')
  @ApiOperation({ summary: 'Get the invoice email template (saved or default) + available variables' })
  getEmailTemplate(@Req() req: any) {
    return this.mailer.getEmailTemplate(req.tenantId);
  }

  @Put('email-template')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Save the PDF payment instructions' })
  updateEmailTemplate(@Req() req: any, @Body() dto: UpdateInvoiceEmailTemplateDto) {
    return this.mailer.updateEmailTemplate(req.tenantId, dto);
  }

  // ── Named email templates (plain-text body) ──

  @Get('email-templates')
  @ApiOperation({ summary: 'List invoice email templates' })
  listEmailTemplates(@Req() req: any) {
    return this.mailer.listTemplates(req.tenantId);
  }

  @Post('email-templates')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create an invoice email template' })
  createEmailTemplate(@Req() req: any, @Body() dto: any) {
    return this.mailer.createTemplate(req.tenantId, dto);
  }

  @Patch('email-templates/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an invoice email template' })
  updateEmailTemplateById(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.mailer.updateTemplate(req.tenantId, id, dto);
  }

  @Delete('email-templates/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete an invoice email template' })
  deleteEmailTemplate(@Req() req: any, @Param('id') id: string) {
    return this.mailer.deleteTemplate(req.tenantId, id);
  }

  // ── Billing entities (legal companies that issue invoices) ──

  @Get('billing-entities')
  @ApiOperation({ summary: 'List the tenant\'s billing entities (issuing companies)' })
  listBillingEntities(@Req() req: any) {
    return this.invoicesService.listBillingEntities(req.tenantId);
  }

  @Post('billing-entities')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a billing entity' })
  createBillingEntity(@Req() req: any, @Body() dto: any) {
    return this.invoicesService.createBillingEntity(req.tenantId, dto);
  }

  @Patch('billing-entities/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a billing entity' })
  updateBillingEntity(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.invoicesService.updateBillingEntity(req.tenantId, id, dto);
  }

  @Delete('billing-entities/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a billing entity (not default, no invoices)' })
  deleteBillingEntity(@Req() req: any, @Param('id') id: string) {
    return this.invoicesService.deleteBillingEntity(req.tenantId, id);
  }

  @Get(':id/pdf')
  async downloadPdf(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const invoice = await this.invoicesService.findOne(req.tenantId, id);
    const issuer = await this.invoicesService.getIssuerInfo(req.tenantId, invoice);
    const buffer = await this.pdfService.generatePdf({ ...invoice, tenant: issuer } as any);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.invoicesService.findOne(req.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update invoice (date, tax, notes)' })
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    await this.access.assertCanWrite(req.tenantId, id, req.user.id, req.user.role);
    return this.invoicesService.update(req.tenantId, id, dto, req.user?.id);
  }

  @Post(':id/send')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark invoice as sent (status flip only — does NOT email)' })
  async markSent(@Req() req: any, @Param('id') id: string) {
    await this.access.assertCanWrite(req.tenantId, id, req.user.id, req.user.role);
    return this.invoicesService.markSent(req.tenantId, id, req.user?.id);
  }

  @Post(':id/pay')
  @HttpCode(200)
  @ApiOperation({ summary: '[LEGACY] Quick mark-paid with single amount (use /payments instead)' })
  async markPaid(@Req() req: any, @Param('id') id: string, @Body() dto: MarkPaidDto) {
    await this.access.assertCanWrite(req.tenantId, id, req.user.id, req.user.role);
    return this.invoicesService.markPaid(req.tenantId, id, dto, req.user?.id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@Req() req: any, @Param('id') id: string) {
    await this.access.assertCanWrite(req.tenantId, id, req.user.id, req.user.role);
    return this.invoicesService.cancel(req.tenantId, id, req.user?.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a DRAFT or CANCELLED invoice (others must be cancelled/voided)' })
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.access.assertCanWrite(req.tenantId, id, req.user.id, req.user.role);
    return this.invoicesService.remove(req.tenantId, id);
  }

  // ─────────── NEW: payments ───────────
  @Get(':id/payments')
  @ApiOperation({ summary: 'List payments + outstanding summary for an invoice' })
  listPayments(@Req() req: any, @Param('id') id: string) {
    return this.payments.listForInvoice(req.tenantId, id);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Record a payment (multi-currency + bank-fee aware)' })
  async recordPayment(@Req() req: any, @Param('id') id: string, @Body() dto: RecordPaymentDto) {
    await this.access.assertCanWrite(req.tenantId, id, req.user.id, req.user.role);
    return this.payments.recordPayment(req.tenantId, id, dto, req.user.id);
  }

  @Delete(':id/payments/:paymentId')
  @ApiOperation({ summary: 'Remove a payment (e.g. recorded in error)' })
  async removePayment(@Req() req: any, @Param('id') id: string, @Param('paymentId') paymentId: string) {
    await this.access.assertCanWrite(req.tenantId, id, req.user.id, req.user.role);
    return this.payments.removePayment(req.tenantId, id, paymentId, req.user.id);
  }

  // ─────────── NEW: write-off ───────────
  @Patch(':id/write-off')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Write off shortfall (admin-only). Closes the invoice if outstanding becomes 0.' })
  writeOff(@Req() req: any, @Param('id') id: string, @Body() dto: WriteOffDto) {
    return this.payments.writeOff(req.tenantId, id, dto, req.user.id);
  }

  // ─────────── NEW: send email ───────────
  @Post(':id/send-email')
  @HttpCode(200)
  @ApiOperation({ summary: 'Email the invoice PDF to the client.  Flips DRAFT → SENT.' })
  async sendEmail(@Req() req: any, @Param('id') id: string, @Body() dto: SendInvoiceEmailDto) {
    await this.access.assertCanWrite(req.tenantId, id, req.user.id, req.user.role);
    return this.mailer.send(req.tenantId, id, dto, req.user.id);
  }

  // ─────────── NEW: explicit autogen trigger (admin tool) ───────────
  @Post('autogen/run')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually trigger the daily autogen sweep (does what the cron does)' })
  autogenAll() {
    return this.autoGen.ensureAllDraftsForCurrentMonth();
  }
  // ─────────── NEW: line items (DRAFT only) ───────────
  @Get(':id/line-items')
  @ApiOperation({ summary: 'List line items' })
  listLineItems(@Req() req: any, @Param('id') id: string) {
    return this.lineItems.list(req.tenantId, id);
  }

  @Post(':id/line-items')
  @ApiOperation({ summary: 'Add a line item (DRAFT only). Negative rate allowed for deductions.' })
  async addLineItem(@Req() req: any, @Param('id') id: string, @Body() dto: AddLineItemDto) {
    await this.access.assertCanWrite(req.tenantId, id, req.user.id, req.user.role);
    return this.lineItems.add(req.tenantId, id, dto, req.user.id);
  }

  @Patch(':id/line-items/:lineId')
  @ApiOperation({ summary: 'Update a line item (DRAFT only)' })
  async updateLineItem(@Req() req: any, @Param('id') id: string, @Param('lineId') lineId: string, @Body() dto: UpdateLineItemDto) {
    await this.access.assertCanWrite(req.tenantId, id, req.user.id, req.user.role);
    return this.lineItems.update(req.tenantId, id, lineId, dto, req.user.id);
  }

  @Delete(':id/line-items/:lineId')
  @ApiOperation({ summary: 'Remove a line item (DRAFT only)' })
  async removeLineItem(@Req() req: any, @Param('id') id: string, @Param('lineId') lineId: string) {
    await this.access.assertCanWrite(req.tenantId, id, req.user.id, req.user.role);
    return this.lineItems.remove(req.tenantId, id, lineId, req.user.id);
  }

  @Post(':id/regenerate-line-items')
  @ApiOperation({ summary: 'Wipe assignment-linked items, re-derive from current assignments. Preserves manual items.' })
  async regenerateLineItems(@Req() req: any, @Param('id') id: string) {
    await this.access.assertCanWrite(req.tenantId, id, req.user.id, req.user.role);
    return this.lineItems.regenerate(req.tenantId, id, req.user.id);
  }

}
