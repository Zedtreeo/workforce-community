import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, Res, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { EmployeeCodeService } from './employee-code.service';
import { ResumeService } from '../resume/resume.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('onboarding')
@ApiTags('Onboarding')
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly employeeCode: EmployeeCodeService,
    private readonly resume: ResumeService,
  ) {}

  // ── Admin endpoints (protected) ──

  @Post('parse-resume')
  @ApiBearerAuth('bearer')
  @UseGuards(AuthGuard, TenantGuard, RbacGuard)
  @Roles(UserRole.ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Extract candidate details from a resume (PDF/image) to pre-fill the offer' })
  parseResume(@UploadedFile() file: any) {
    return this.resume.extract(file);
  }

  @Get('next-employee-code')
  @ApiBearerAuth('bearer')
  @UseGuards(AuthGuard, TenantGuard, RbacGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Preview the next auto employee code (does not consume it)' })
  async nextEmployeeCode(@Req() req: any) {
    return { code: await this.employeeCode.peek(req.tenantId) };
  }

  @Post('create')
  @ApiBearerAuth('bearer')
  @UseGuards(AuthGuard, TenantGuard, RbacGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create employee with offer letter and invite' })
  createEmployee(@Req() req: any, @Body() body: any) {
    return this.onboardingService.createEmployeeWithOffer(req.tenantId, body, req.user?.id);
  }

  @Delete(':id')
  @ApiBearerAuth('bearer')
  @UseGuards(AuthGuard, TenantGuard, RbacGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete an onboarding invite (purges offer letter, docs, frees the email/code)' })
  deleteInvite(@Req() req: any, @Param('id') id: string) {
    return this.onboardingService.deleteInvite(req.tenantId, id);
  }

  @Get('list')
  @ApiBearerAuth('bearer')
  @UseGuards(AuthGuard, TenantGuard, RbacGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List employees with onboarding status' })
  listOnboarding(@Req() req: any, @Query('status') status?: string) {
    return this.onboardingService.getOnboardingList(req.tenantId, status);
  }

  @Post(':employeeId/resend-invite')
  @ApiBearerAuth('bearer')
  @UseGuards(AuthGuard, TenantGuard, RbacGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Resend onboarding invite' })
  resendInvite(@Req() req: any, @Param('employeeId') employeeId: string) {
    return this.onboardingService.resendInvite(req.tenantId, employeeId);
  }

  // ── Public endpoints (token-based) ──

  @Get('invite/:token')
  @ApiOperation({ summary: 'Validate invite token and get onboarding data' })
  validateInvite(@Param('token') token: string) {
    return this.onboardingService.validateInvite(token);
  }

  @Post('invite/:token/create-account')
  @ApiOperation({ summary: 'Create account with password' })
  createAccount(@Param('token') token: string, @Body() body: { password: string }) {
    return this.onboardingService.createAccount(token, body);
  }

  @Get('invite/:token/offer-letter')
  @ApiOperation({ summary: 'Download the offer letter PDF (for the candidate to sign)' })
  async downloadOfferLetter(@Param('token') token: string, @Res() res: Response) {
    const { buffer, fileName } = await this.onboardingService.getOfferLetterFile(token);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  @Post('invite/:token/signed-offer')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload the signed offer letter (signing = accepting)' })
  uploadSignedOffer(@Param('token') token: string, @UploadedFile() file: any) {
    return this.onboardingService.uploadSignedOffer(token, file);
  }

  @Post('invite/:token/accept-offer')
  @ApiOperation({ summary: 'Accept offer letter' })
  acceptOffer(@Param('token') token: string) {
    return this.onboardingService.acceptOffer(token);
  }

  @Patch('invite/:token/details')
  @ApiOperation({ summary: 'Update personal details' })
  updateDetails(@Param('token') token: string, @Body() body: any) {
    return this.onboardingService.updateDetails(token, body);
  }

  @Get('invite/:token/documents')
  @ApiOperation({ summary: 'Get document categories and uploaded docs' })
  getDocuments(@Param('token') token: string) {
    return this.onboardingService.getUploadedDocuments(token);
  }

  @Post('invite/:token/documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload onboarding document' })
  uploadDocument(
    @Param('token') token: string,
    @UploadedFile() file: any,
    @Body() body: { categoryCode: string; notes?: string },
  ) {
    return this.onboardingService.uploadDocument(token, file, body);
  }

  @Get('reset/:token')
  @ApiOperation({ summary: 'Validate a password reset token' })
  validatePasswordReset(@Param('token') token: string) {
    return this.onboardingService.validatePasswordReset(token);
  }

  @Post('reset/:token')
  @ApiOperation({ summary: 'Set a new password via reset token' })
  setPasswordViaReset(@Param('token') token: string, @Body() body: { password: string }) {
    return this.onboardingService.setPasswordViaReset(token, body);
  }

  @Post('invite/:token/complete')
  @ApiOperation({ summary: 'Complete onboarding' })
  completeOnboarding(@Param('token') token: string) {
    return this.onboardingService.completeOnboarding(token);
  }
}
