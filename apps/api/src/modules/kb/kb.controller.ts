import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { KbService } from './kb.service';
import { CreateHelpContentDto } from './dto/create-help-content.dto';
import { UpdateHelpContentDto } from './dto/update-help-content.dto';
import { CreateKbArticleDto } from './dto/create-kb-article.dto';
import { UpdateKbArticleDto } from './dto/update-kb-article.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('kb')
@ApiTags('Knowledge Base')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
@ApiBearerAuth('bearer')
export class KbController {
  constructor(private readonly kbService: KbService) {}

  // ─── Unified Search ──────────────────────────────────────────

  @Get('search')
  @ApiOperation({ summary: 'Search help content and KB articles' })
  @ApiResponse({ status: 200, description: 'Search results from both help content and articles' })
  search(
    @Req() req: any,
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.kbService.search(
      req.tenantId,
      query,
      limit ? parseInt(limit, 10) : 10,
      req.user?.role,
    );
  }

  // ─── Help Content (Field Tooltips) ───────────────────────────

  @Roles(UserRole.MANAGER)
  @Post('help')
  @ApiOperation({ summary: 'Create help content entry' })
  @ApiResponse({ status: 201, description: 'Help content created' })
  @ApiResponse({ status: 409, description: 'Key already exists' })
  createHelpContent(@Req() req: any, @Body() dto: CreateHelpContentDto) {
    return this.kbService.createHelpContent(req.tenantId, dto);
  }

  @Get('help')
  @ApiOperation({ summary: 'List all help content (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated help content list' })
  findAllHelpContent(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('module') module?: string,
  ) {
    return this.kbService.findAllHelpContent(req.tenantId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      search,
      module,
    }, req.user?.role);
  }

  @Get('help/module/:module')
  @ApiOperation({ summary: 'Get all help content for a specific module' })
  @ApiResponse({ status: 200, description: 'Module help content array' })
  findHelpContentByModule(@Req() req: any, @Param('module') module: string) {
    return this.kbService.findHelpContentByModule(req.tenantId, module, req.user?.role);
  }

  @Get('help/key/:key')
  @ApiOperation({ summary: 'Get help content by key' })
  @ApiResponse({ status: 200, description: 'Single help content entry' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findHelpContentByKey(@Req() req: any, @Param('key') key: string) {
    return this.kbService.findHelpContentByKey(req.tenantId, key);
  }

  @Roles(UserRole.MANAGER)
  @Patch('help/:id')
  @ApiOperation({ summary: 'Update help content entry' })
  @ApiResponse({ status: 200, description: 'Updated help content' })
  @ApiResponse({ status: 404, description: 'Not found' })
  updateHelpContent(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateHelpContentDto,
  ) {
    return this.kbService.updateHelpContent(req.tenantId, id, dto);
  }

  @Roles(UserRole.MANAGER)
  @Delete('help/:id')
  @ApiOperation({ summary: 'Deactivate help content entry' })
  @ApiResponse({ status: 200, description: 'Help content deactivated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  removeHelpContent(@Req() req: any, @Param('id') id: string) {
    return this.kbService.removeHelpContent(req.tenantId, id);
  }

  // ─── KB Articles ─────────────────────────────────────────────

  @Roles(UserRole.MANAGER)
  @Post('articles')
  @ApiOperation({ summary: 'Create KB article' })
  @ApiResponse({ status: 201, description: 'Article created' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  createArticle(@Req() req: any, @Body() dto: CreateKbArticleDto) {
    return this.kbService.createArticle(req.tenantId, dto);
  }

  @Get('articles')
  @ApiOperation({ summary: 'List KB articles (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated article list' })
  findAllArticles(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('module') module?: string,
    @Query('category') category?: string,
    @Query('published') published?: string,
  ) {
    return this.kbService.findAllArticles(req.tenantId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      module,
      category,
      published: published !== undefined ? published === 'true' : undefined,
    }, req.user?.role);
  }

  @Get('articles/slug/:slug')
  @ApiOperation({ summary: 'Get KB article by slug (increments view count)' })
  @ApiResponse({ status: 200, description: 'Full article with content' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findArticleBySlug(@Req() req: any, @Param('slug') slug: string) {
    return this.kbService.findArticleBySlug(req.tenantId, slug, req.user?.role);
  }

  @Get('articles/:id')
  @ApiOperation({ summary: 'Get KB article by ID' })
  @ApiResponse({ status: 200, description: 'Full article with content' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findArticleById(@Req() req: any, @Param('id') id: string) {
    return this.kbService.findArticleById(req.tenantId, id, req.user?.role);
  }

  @Roles(UserRole.MANAGER)
  @Patch('articles/:id')
  @ApiOperation({ summary: 'Update KB article' })
  @ApiResponse({ status: 200, description: 'Updated article' })
  @ApiResponse({ status: 404, description: 'Not found' })
  updateArticle(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateKbArticleDto,
  ) {
    return this.kbService.updateArticle(req.tenantId, id, dto);
  }

  @Roles(UserRole.MANAGER)
  @Delete('articles/:id')
  @ApiOperation({ summary: 'Soft delete KB article' })
  @ApiResponse({ status: 200, description: 'Article soft-deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  removeArticle(@Req() req: any, @Param('id') id: string) {
    return this.kbService.removeArticle(req.tenantId, id);
  }
}
