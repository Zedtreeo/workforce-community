import {
  Controller, Get, Post, Delete, Body, Param, Query, Req, Res, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { DocumentsService } from './documents.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('documents')
@ApiTags('Documents')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // ── Categories ──

  @Get('categories')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'List document categories' })
  @ApiResponse({ status: 200, description: 'List of document categories returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  getCategories(@Req() req: any) {
    return this.documentsService.getCategories(req.tenantId);
  }

  @Post('categories')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create document category' })
  @ApiResponse({ status: 201, description: 'Document category created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  createCategory(@Req() req: any, @Body() dto: CreateCategoryDto) {
    return this.documentsService.createCategory(req.tenantId, dto);
  }

  // ── Documents ──

  @Get()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'List documents' })
  @ApiResponse({ status: 200, description: 'List of documents returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  getDocuments(
    @Req() req: any,
    @Query('employeeId') employeeId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.documentsService.getDocuments(req.tenantId, { employeeId, categoryId });
  }

  @Post('upload')
  @Roles(UserRole.ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload employee document' })
  @ApiResponse({ status: 201, description: 'Employee document uploaded' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  uploadDocument(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body() body: { employeeId: string; categoryId: string; notes?: string; expiryDate?: string },
  ) {
    return this.documentsService.uploadDocument(req.tenantId, file, body, req.user.id);
  }

  @Get('expiring')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Documents expiring soon' })
  @ApiResponse({ status: 200, description: 'Documents expiring within specified days returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  getExpiring(@Req() req: any, @Query('days') days?: string) {
    return this.documentsService.getExpiringDocuments(req.tenantId, days ? +days : 30);
  }

  @Get(':id/download')
  @Roles(UserRole.MEMBER)
  @ApiOperation({ summary: 'Download a document' })
  @ApiResponse({ status: 200, description: 'Document file downloaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async downloadDocument(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const { filePath, fileName, mimeType } = await this.documentsService.downloadDocument(req.tenantId, id);
    res.set({
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    res.sendFile(filePath);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a document' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Not found' })
  deleteDocument(@Req() req: any, @Param('id') id: string) {
    return this.documentsService.deleteDocument(req.tenantId, id);
  }
}
