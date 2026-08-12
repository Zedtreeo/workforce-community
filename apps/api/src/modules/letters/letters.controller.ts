// apps/api/src/modules/letters/letters.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, Res, UseGuards,
  NotFoundException, BadRequestException, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';

import { PrismaService } from '../../prisma';
import { LetterGenerationService } from './services/letter-generation.service';
import { VariableResolverService } from './services/variable-resolver.service';
import { LetterMailerService } from './services/letter-mailer.service';
import {
  PreviewLetterDto, GenerateLetterDto, SendLetterDto, MarkStatusDto,
} from './dto/letters.dto';
import { LetterType } from '@prisma/client';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

// Offer/appointment letters embed SALARY. Gate at MANAGER+ so a MEMBER can't
// list or download other employees' letters (their own onboarding letter is
// delivered via the onboarding invite flow, not these admin routes).
@Controller('letters')
@ApiTags('Letters')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
@Roles(UserRole.MANAGER)
@ApiBearerAuth('bearer')
export class LettersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gen: LetterGenerationService,
    private readonly resolver: VariableResolverService,
    private readonly mailer: LetterMailerService,
  ) {}

  // ─────── Templates ───────
  @Get('templates')
  @ApiOperation({ summary: 'List active letter templates for this tenant' })
  @ApiQuery({ name: 'type', enum: LetterType, required: false })
  templates(@Req() req: any, @Query('type') type?: LetterType) {
    return this.prisma.letterTemplate.findMany({
      where: { tenantId: req.tenantId, isActive: true, ...(type && { type }) },
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
      select: {
        id: true, type: true, name: true, description: true,
        isDefault: true, version: true, variables: true,
      },
    });
  }

  // ─────── Settings ───────
  @Get('settings')
  @ApiOperation({ summary: 'Get per-tenant letter defaults (probation, location, signatory, etc.)' })
  async getSettings(@Req() req: any) {
    return this.resolver.getOrCreateSettings(req.tenantId);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update tenant letter defaults' })
  async updateSettings(@Req() req: any, @Body() body: any) {
    await this.resolver.getOrCreateSettings(req.tenantId);
    return this.prisma.tenantLetterSettings.update({
      where: { tenantId: req.tenantId },
      data: {
        ...(body.defaultWorkingHours   !== undefined && { defaultWorkingHours: body.defaultWorkingHours }),
        ...(body.defaultProbationDays  !== undefined && { defaultProbationDays: body.defaultProbationDays }),
        ...(body.defaultLocation       !== undefined && { defaultLocation: body.defaultLocation }),
        ...(body.signatoryName         !== undefined && { signatoryName: body.signatoryName }),
        ...(body.signatoryTitle        !== undefined && { signatoryTitle: body.signatoryTitle }),
        ...(body.refNumberPrefix       !== undefined && { refNumberPrefix: body.refNumberPrefix }),
      },
    });
  }

  // ─────── Preview ───────
  @Post('preview')
  @ApiOperation({ summary: 'Resolve variable context + editable fields for a letter (no DB write)' })
  preview(@Req() req: any, @Body() dto: PreviewLetterDto) {
    return this.gen.preview(req.tenantId, dto);
  }

  // ─────── Preview-render (view before generate) ───────
  @Post('preview-render')
  @ApiOperation({ summary: 'Render a draft PDF from current data + overrides WITHOUT saving or minting a reference number.' })
  async previewRender(@Req() req: any, @Body() dto: GenerateLetterDto, @Res() res: Response) {
    const { buffer, fileName, mimeType } = await this.gen.previewRender(req.tenantId, dto);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  }

  // ─────── Generate ───────
  @Post('generate')
  @ApiOperation({ summary: 'Generate a letter (DOCX + optional PDF). Returns the GeneratedLetter row.' })
  generate(@Req() req: any, @Body() dto: GenerateLetterDto) {
    return this.gen.generate(req.tenantId, {
      ...dto,
      userId: req.user?.id ?? 'system',
    });
  }

  // ─────── Download / Preview ───────
  @Get(':id/download')
  @ApiOperation({ summary: 'Download a generated letter as DOCX, PDF, or the signed copy. Pass disposition=inline to preview in-browser.' })
  @ApiQuery({ name: 'format', enum: ['docx', 'pdf', 'signed'], required: false })
  @ApiQuery({ name: 'disposition', enum: ['attachment', 'inline'], required: false })
  async download(
    @Req() req: any,
    @Param('id') id: string,
    @Query('format') format: 'docx' | 'pdf' | 'signed' = 'pdf',
    @Query('disposition') disposition: 'attachment' | 'inline' = 'attachment',
    @Res() res: Response,
  ) {
    const { buffer, fileName, mimeType } = await this.gen.download(req.tenantId, id, format);
    const mode = disposition === 'inline' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `${mode}; filename="${fileName}"`);
    res.send(buffer);
  }

  // ─────── Send via email ───────
  @Post(':id/send')
  @ApiOperation({ summary: 'Email a generated letter as an attachment (uses system EmailService)' })
  send(@Req() req: any, @Param('id') id: string, @Body() dto: SendLetterDto) {
    return this.mailer.sendLetter(req.tenantId, id, dto, req.user?.id ?? 'system');
  }

  @Post(':id/upload-signed')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a client-counter-signed copy; marks the agreement ACCEPTED' })
  uploadSigned(@Req() req: any, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.gen.uploadSignedCopy(req.tenantId, id, file.buffer, file.originalname, req.user?.id ?? 'system');
  }

  // ─────── Status changes (Mark accepted/rejected/voided/sent-externally) ───────
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update letter status (DRAFT/SENT/ACCEPTED/REJECTED/VOIDED)' })
  markStatus(@Req() req: any, @Param('id') id: string, @Body() dto: MarkStatusDto) {
    return this.gen.markStatus(req.tenantId, id, dto.status as any, req.user?.id ?? 'system', dto.sentTo);
  }

  // ─────── Delete ───────
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a generated letter and its files. Blocked for counter-signed (ACCEPTED) agreements — Void those instead.' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.gen.remove(req.tenantId, id, req.user?.id ?? 'system');
  }

  // ─────── History ───────
  @Get('history')
  @ApiOperation({ summary: 'List generated letters for an employee/client/type' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'clientId',   required: false })
  @ApiQuery({ name: 'type',       enum: LetterType, required: false })
  @ApiQuery({ name: 'limit',      required: false })
  history(
    @Req() req: any,
    @Query('employeeId') employeeId?: string,
    @Query('clientId')   clientId?: string,
    @Query('type')       type?: LetterType,
    @Query('limit')      limit?: string,
  ) {
    return this.gen.history(req.tenantId, {
      employeeId, clientId, type,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
