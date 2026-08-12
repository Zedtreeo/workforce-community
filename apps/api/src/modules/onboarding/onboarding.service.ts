import {
  Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, Logger,
} from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { LetterGenerationService } from '../letters/services/letter-generation.service';
import { PrismaService } from '../../prisma';
import { EmployeeCodeService } from './employee-code.service';
import { Prisma } from '@prisma/client';
import { randomBytes, scrypt } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

// Fields the candidate fills during onboarding. NOTE: 'designation' is
// intentionally NOT here — it is set from the offer letter by the employer and
// the details form has no designation input, so including it would overwrite
// the real designation with an empty value.
const EDITABLE_FIELDS = [
  'firstName', 'lastName', 'phone',
  'pfNumber', 'esiNumber', 'panNumber',
  'bankAccount', 'bankIfsc', 'bankName', 'bankBranch',
];

const ALLOWED_DOC_MIMES = [
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
];

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly employeeCode: EmployeeCodeService,
    private readonly letterGen: LetterGenerationService,
  ) {}

  private readonly logger = new Logger(OnboardingService.name);

  // ── Admin: Create employee + offer letter + invite ──

  async createEmployeeWithOffer(tenantId: string, dto: any, userId: string) {
    const { offerLetter, ...employeeData } = dto;

    // Check email uniqueness. If the email belongs to a previously-deleted
    // onboarding invite, reclaim it (purge the stale row) instead of blocking.
    const existingEmail = await this.prisma.employee.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });
    if (existingEmail) {
      const reclaimable = existingEmail.deletedAt && existingEmail.onboardingStatus && existingEmail.status !== 'ACTIVE';
      if (reclaimable) {
        await this.purgeOnboardingEmployee(tenantId, existingEmail.id);
      } else {
        throw new ConflictException(`Employee email "${dto.email}" already exists`);
      }
    }

    // Auto-assign a unique employee code (continues from the highest existing code).
    const employeeCode = await this.employeeCode.next(tenantId);

    // Generate invite token
    const inviteToken = randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create employee + offer letter in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          tenantId,
          employeeCode,
          firstName: employeeData.firstName,
          lastName: employeeData.lastName,
          email: employeeData.email,
          phone: employeeData.phone || null,
          designation: offerLetter.designation,
          departmentId: employeeData.departmentId || null,
          joinDate: new Date(offerLetter.joiningDate),
          salary: new Prisma.Decimal(offerLetter.salary),
          status: 'INACTIVE',
          onboardingStatus: 'INVITED',
          approvalStatus: 'INVITED' as any,
          inviteToken,
          inviteExpiresAt,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      const offer = await tx.offerLetter.create({
        data: {
          tenantId,
          employeeId: employee.id,
          designation: offerLetter.designation,
          department: offerLetter.department || null,
          salary: new Prisma.Decimal(offerLetter.salary),
          joiningDate: new Date(offerLetter.joiningDate),
          probationMonths: offerLetter.probationMonths || 6,
          workLocation: offerLetter.workLocation || null,
          reportingTo: offerLetter.reportingTo || null,
          workSchedule: offerLetter.workSchedule || null,
          employmentType: offerLetter.employmentType === 'PART_TIME' ? 'PART_TIME' : 'FULL_TIME',
          benefits: offerLetter.benefits || null,
          terms: offerLetter.terms || null,
        },
      });

      return { employee, offerLetter: offer, inviteToken };
    });

    // Send invite email (fire-and-forget — never block the response)
    this.sendInviteEmail(result.employee, result.inviteToken).catch((err) => {
      // logged in EmailService
    });

    return result;
  }

  /** Hard-delete an onboarding invite and everything tied to it (offer letter,
   *  generated letters, uploaded documents). Frees the email + code for reuse. */
  private async purgeOnboardingEmployee(tenantId: string, employeeId: string) {
    await this.prisma.$transaction([
      this.prisma.generatedLetter.deleteMany({ where: { tenantId, employeeId } }),
      this.prisma.employeeDocument.deleteMany({ where: { tenantId, employeeId } }),
      this.prisma.offerLetter.deleteMany({ where: { tenantId, employeeId } }),
      this.prisma.employee.deleteMany({ where: { id: employeeId, tenantId } }),
    ]);
  }

  /** Admin: delete an onboarding invite (only non-active onboarding employees). */
  async deleteInvite(tenantId: string, employeeId: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      select: { id: true, status: true, onboardingStatus: true },
    });
    if (!emp) throw new NotFoundException('Employee not found');
    if (!emp.onboardingStatus || emp.status === 'ACTIVE') {
      throw new BadRequestException('Only onboarding (non-active) employees can be deleted here.');
    }
    await this.purgeOnboardingEmployee(tenantId, employeeId);
    return { ok: true };
  }

  /** Send (or resend) the onboarding invite email with the magic link. */
  private async sendInviteEmail(employee: any, inviteToken: string) {
    const baseUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';
    const link = `${baseUrl}/onboarding/${inviteToken}`;
    const subject = `Your offer from your new employer — please complete onboarding`;
    const html = `
      <p>Hi ${employee.firstName || ''},</p>
      <p>You have received an offer letter. To accept the offer and complete your onboarding,
      please click the link below within 7 days:</p>
      <p><a href="${link}" style="background:#4f46e5;color:white;padding:10px 16px;border-radius:6px;
      text-decoration:none">Open onboarding</a></p>
      <p>Or copy this link:<br><code>${link}</code></p>
      <p>Your offer letter is attached to this email. You will be asked to accept the offer,
      fill in your details, and upload your documents. After you submit, our HR team will
      review your application and contact you once approved — you’ll then sign in with a
      one-time code (OTP) sent to this email, no password needed.</p>
      <p>— HRMS Platform</p>`;

    // Generate + attach the offer letter PDF (best-effort — never block the invite).
    let attachments: { filename: string; content: Buffer; contentType?: string }[] | undefined;
    try {
      const letter = await this.letterGen.autoGenerateOffer(
        employee.tenantId,
        employee.id,
        employee.createdBy || employee.updatedBy || 'system',
      );
      if (letter?.pdfPath && fs.existsSync(letter.pdfPath)) {
        const label = employee.employeeCode || `${employee.firstName || ''}`.trim() || 'offer';
        attachments = [{
          filename: `Offer-Letter-${label}.pdf`,
          content: fs.readFileSync(letter.pdfPath),
          contentType: 'application/pdf',
        }];
      }
    } catch (err: any) {
      this.logger.warn(`Offer-letter attachment skipped: ${err?.message}`);
    }

    await this.email.send({ to: employee.email, subject, html, attachments });
  }

  // ── Public: Validate invite token ──

  async validateInvite(token: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { inviteToken: token },
      include: {
        offerLetter: true,
        tenant: { select: { name: true, logo: true } },
      },
    });

    if (!employee) throw new NotFoundException('Invalid invite link');
    if (employee.inviteExpiresAt && employee.inviteExpiresAt < new Date()) {
      throw new BadRequestException('Invite link has expired. Please contact your administrator.');
    }

    return {
      employeeId: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      onboardingStatus: employee.onboardingStatus,
      companyName: employee.tenant.name,
      companyLogo: employee.tenant.logo,
      offerLetter: employee.offerLetter,
    };
  }

  // ── Public: Create account (set password) ──

  async createAccount(token: string, dto: { password?: string }) {
    const employee = await this.prisma.employee.findUnique({
      where: { inviteToken: token },
    });
    if (!employee) throw new NotFoundException('Invalid invite link');
    if (employee.inviteExpiresAt && employee.inviteExpiresAt < new Date()) {
      throw new BadRequestException('Invite link has expired');
    }

    // Login is passwordless (email OTP). A password is optional/legacy — if one
    // is provided we still set it; otherwise the account is created OTP-only.
    const hashedPassword =
      dto?.password && dto.password.length >= 8 ? await this.hashPassword(dto.password) : null;

    // Tolerate a pre-existing account: an admin may have granted portal access
    // before onboarding (which creates the Better Auth user), or the candidate
    // may be re-running this step. Either way, don't error — set their password
    // on the existing credential account (creating one if missing) and advance.
    const existingUser = await this.prisma.user.findFirst({
      where: { tenantId: employee.tenantId, email: employee.email, deletedAt: null },
    });

    if (existingUser) {
      // Only touch the credential account if a password was actually provided.
      if (hashedPassword) {
        const updated = await this.prisma.account.updateMany({
          where: { userId: existingUser.id, providerId: 'credential' },
          data: { password: hashedPassword },
        });
        if (updated.count === 0) {
          await this.prisma.account.create({
            data: {
              userId: existingUser.id,
              accountId: employee.email,
              providerId: 'credential',
              password: hashedPassword,
            },
          });
        }
      }
    } else {
      await this.prisma.user.create({
        data: {
          tenantId: employee.tenantId,
          email: employee.email,
          name: `${employee.firstName} ${employee.lastName}`,
          role: 'MEMBER',
          emailVerified: true,
          // OTP-only account unless a legacy password was supplied.
          ...(hashedPassword
            ? {
                accounts: {
                  create: {
                    accountId: employee.email,
                    providerId: 'credential',
                    password: hashedPassword,
                  },
                },
              }
            : {}),
        },
      });
    }

    // Advance onboarding (idempotent — only move forward from the account step).
    if (employee.onboardingStatus === 'INVITED') {
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { onboardingStatus: 'OFFER_PENDING' },
      });
    }

    return { message: 'Account ready', email: employee.email };
  }

  // ── Public: Accept offer letter ──

  async acceptOffer(token: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { inviteToken: token },
      include: { offerLetter: true },
    });
    if (!employee) throw new NotFoundException('Invalid invite link');
    if (!employee.offerLetter) throw new BadRequestException('No offer letter found');

    await this.prisma.$transaction([
      this.prisma.offerLetter.update({
        where: { id: employee.offerLetter.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      }),
      this.prisma.employee.update({
        where: { id: employee.id },
        data: { onboardingStatus: 'DETAILS_PENDING', offerAcceptedAt: new Date() },
      }),
    ]);

    return { message: 'Offer accepted successfully' };
  }

  // ── Public: Download the offer letter PDF (for the candidate to sign) ──

  async getOfferLetterFile(token: string): Promise<{ buffer: Buffer; fileName: string }> {
    const employee = await this.prisma.employee.findUnique({
      where: { inviteToken: token },
      select: { id: true, tenantId: true, employeeCode: true },
    });
    if (!employee) throw new NotFoundException('Invalid invite link');

    // Find the latest generated offer PDF; regenerate on demand if missing.
    let letter = await this.prisma.generatedLetter.findFirst({
      where: { tenantId: employee.tenantId, employeeId: employee.id, type: 'OFFER_LETTER' },
      orderBy: { generatedAt: 'desc' },
    });
    if (!letter || !letter.pdfPath || !fs.existsSync(letter.pdfPath)) {
      letter = await this.letterGen.autoGenerateOffer(employee.tenantId, employee.id, 'system');
    }
    if (!letter || !letter.pdfPath || !fs.existsSync(letter.pdfPath)) {
      throw new NotFoundException('Offer letter is not available for download. Please contact HR.');
    }
    return {
      buffer: fs.readFileSync(letter.pdfPath),
      fileName: `Offer-Letter-${employee.employeeCode || employee.id}.pdf`,
    };
  }

  // ── Public: Upload the SIGNED offer letter (signing = accepting) ──

  async uploadSignedOffer(token: string, file: any) {
    const employee = await this.prisma.employee.findUnique({
      where: { inviteToken: token },
      include: { offerLetter: true },
    });
    if (!employee) throw new NotFoundException('Invalid invite link');
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (file.mimetype !== 'application/pdf' && ext !== '.pdf') {
      throw new BadRequestException('Please upload the signed offer letter as a PDF.');
    }

    // Attach the signed copy to the offer's GeneratedLetter (marks it ACCEPTED +
    // stores signedFilePath). Regenerate the base letter if one doesn't exist yet.
    let letter = await this.prisma.generatedLetter.findFirst({
      where: { tenantId: employee.tenantId, employeeId: employee.id, type: 'OFFER_LETTER' },
      orderBy: { generatedAt: 'desc' },
    });
    if (!letter) {
      letter = await this.letterGen.autoGenerateOffer(employee.tenantId, employee.id, 'system');
    }
    if (letter) {
      await this.letterGen.uploadSignedCopy(
        employee.tenantId,
        letter.id,
        file.buffer,
        file.originalname || 'signed-offer.pdf',
        'candidate',
      );
    } else {
      // No template configured — still persist the signed file so it isn't lost.
      const uploadDir = path.join(process.cwd(), 'uploads', employee.tenantId, employee.id);
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, `signed-offer_${Date.now()}.pdf`), file.buffer);
    }

    // Signing IS accepting — mark the offer accepted and advance onboarding.
    if (employee.offerLetter && employee.offerLetter.status !== 'ACCEPTED') {
      await this.prisma.offerLetter.update({
        where: { id: employee.offerLetter.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
    }
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { onboardingStatus: 'DETAILS_PENDING', offerAcceptedAt: new Date() },
    });

    return { message: 'Signed offer letter uploaded — your offer is now accepted.' };
  }

  // ── Public: Update personal details ──

  async updateDetails(token: string, dto: any) {
    const employee = await this.prisma.employee.findUnique({
      where: { inviteToken: token },
    });
    if (!employee) throw new NotFoundException('Invalid invite link');

    const updateData: any = {};
    for (const field of EDITABLE_FIELDS) {
      if (dto[field] !== undefined) {
        updateData[field] = dto[field] || null;
      }
    }

    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { ...updateData, onboardingStatus: 'DOCUMENTS_PENDING' },
    });

    return { message: 'Details updated successfully' };
  }

  // ── Public: Upload document ──

  async uploadDocument(token: string, file: any, body: { categoryCode: string; notes?: string }) {
    const employee = await this.prisma.employee.findUnique({
      where: { inviteToken: token },
    });
    if (!employee) throw new NotFoundException('Invalid invite link');

    const category = await this.prisma.documentCategory.findFirst({
      where: { tenantId: employee.tenantId, code: body.categoryCode },
    });
    if (!category) throw new NotFoundException('Document category not found');

    // Validate file
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_DOC_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF, PNG, JPG, and WebP files are allowed');
    }

    // Save file
    const uploadDir = path.join(process.cwd(), 'uploads', employee.tenantId, employee.id);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const fileName = `${body.categoryCode}_${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    // Delete existing document for same category (replace)
    await this.prisma.employeeDocument.updateMany({
      where: { employeeId: employee.id, categoryId: category.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    // Create document record
    const doc = await this.prisma.employeeDocument.create({
      data: {
        tenantId: employee.tenantId,
        employeeId: employee.id,
        categoryId: category.id,
        fileName: file.originalname,
        fileUrl: `/uploads/${employee.tenantId}/${employee.id}/${fileName}`,
        fileSize: file.size,
        mimeType: file.mimetype,
        notes: body.notes || null,
        uploadedBy: employee.id,
      },
    });

    return doc;
  }

  // ── Public: Complete onboarding ──

  async completeOnboarding(token: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { inviteToken: token },
      include: {
        documents: { where: { deletedAt: null }, include: { category: true } },
      },
    });
    if (!employee) throw new NotFoundException('Invalid invite link');

    // Check mandatory documents
    const mandatoryCategories = await this.prisma.documentCategory.findMany({
      where: { tenantId: employee.tenantId, isRequired: true },
    });

    const uploadedCategoryIds = employee.documents.map(d => d.categoryId);
    const missing = mandatoryCategories.filter(c => !uploadedCategoryIds.includes(c.id));

    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing mandatory documents: ${missing.map(c => c.name).join(', ')}`
      );
    }

    await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        onboardingStatus: 'COMPLETED',
        approvalStatus: 'SUBMITTED' as any,
        submittedAt: new Date(),
      },
    });

    // Notify admin(s) — fire-and-forget
    this.notifyAdminOfSubmission(employee).catch(() => {});

    return {
      message: 'Application submitted. Awaiting HR approval — you will receive an email once approved.',
      status: 'PENDING_APPROVAL',
    };
  }

  // ── Admin: Get onboarding status ──

  async getOnboardingList(tenantId: string, status?: string) {
    const where: any = {
      tenantId,
      deletedAt: null,
      onboardingStatus: { not: null },
    };
    if (status) where.onboardingStatus = status;

    return this.prisma.employee.findMany({
      where,
      select: {
        id: true, employeeCode: true, firstName: true, lastName: true,
        email: true, designation: true, onboardingStatus: true,
        inviteToken: true, createdAt: true, offerAcceptedAt: true,
        offerLetter: { select: { status: true, designation: true, joiningDate: true } },
        _count: { select: { documents: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }


  /** Notify all admins/managers in the tenant that an application was submitted. */
  private async notifyAdminOfSubmission(employee: any) {
    const baseUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';
    const link = `${baseUrl}/employees/${employee.id}`;
    const admins = await this.prisma.user.findMany({
      where: { tenantId: employee.tenantId, role: { in: ['ADMIN' as any, 'MANAGER' as any, 'OWNER' as any] } },
      select: { email: true, name: true },
    });
    const html = `
      <p>A new employee has submitted their onboarding application:</p>
      <ul>
        <li><strong>Name:</strong> ${employee.firstName || ''} ${employee.lastName || ''}</li>
        <li><strong>Code:</strong> ${employee.employeeCode}</li>
        <li><strong>Email:</strong> ${employee.email}</li>
      </ul>
      <p><a href="${link}">Review and approve</a></p>`;
    for (const a of admins) {
      await this.email.send({
        to: a.email,
        subject: `Onboarding application pending review: ${employee.firstName} ${employee.lastName}`,
        html,
      });
    }
  }

  /** Public re-invite. Also re-sends the email. */
  async resendInvite(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const inviteToken = randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        inviteToken,
        inviteExpiresAt,
        onboardingStatus: 'INVITED',
        approvalStatus: 'INVITED' as any,
      },
    });

    // Fire-and-forget email
    this.sendInviteEmail(employee, inviteToken).catch(() => {});

    return { inviteToken, message: 'Invite link regenerated and email sent' };
  }

  // ── Public: Get uploaded documents for onboarding ──

  async getUploadedDocuments(token: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { inviteToken: token },
    });
    if (!employee) throw new NotFoundException('Invalid invite link');

    const categories = await this.prisma.documentCategory.findMany({
      where: { tenantId: employee.tenantId, isActive: true },
      orderBy: [{ isRequired: 'desc' }, { name: 'asc' }],
    });

    const docs = await this.prisma.employeeDocument.findMany({
      where: { employeeId: employee.id, deletedAt: null },
      include: { category: true },
    });

    return categories.map(cat => ({
      ...cat,
      document: docs.find(d => d.categoryId === cat.id) || null,
    }));
  }

  // ── Public: Password reset via set-password link ──

  async validatePasswordReset(token: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { inviteToken: token },
      include: { tenant: { select: { name: true } } },
    });
    if (!employee) throw new NotFoundException('Invalid or expired reset link');
    if (employee.inviteExpiresAt && employee.inviteExpiresAt < new Date()) {
      throw new BadRequestException('This reset link has expired. Please request a new one.');
    }
    const user = await this.prisma.user.findFirst({
      where: { tenantId: employee.tenantId, email: employee.email, deletedAt: null },
    });
    if (!user) throw new BadRequestException('No portal account found for this email');
    return {
      email: employee.email,
      firstName: employee.firstName,
      lastName: employee.lastName,
      companyName: employee.tenant.name,
    };
  }

  async setPasswordViaReset(token: string, dto: { password: string }) {
    if (!dto?.password || dto.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const employee = await this.prisma.employee.findUnique({ where: { inviteToken: token } });
    if (!employee) throw new NotFoundException('Invalid or expired reset link');
    if (employee.inviteExpiresAt && employee.inviteExpiresAt < new Date()) {
      throw new BadRequestException('This reset link has expired. Please request a new one.');
    }
    const user = await this.prisma.user.findFirst({
      where: { tenantId: employee.tenantId, email: employee.email, deletedAt: null },
    });
    if (!user) throw new BadRequestException('No portal account found for this email');

    const hashedPassword = await this.hashPassword(dto.password);
    await this.prisma.account.updateMany({
      where: { userId: user.id, providerId: 'credential' },
      data: { password: hashedPassword },
    });
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { inviteToken: null, inviteExpiresAt: null },
    });
    return { message: 'Password set successfully. You can now log in.', email: employee.email };
  }

  private hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = randomBytes(16).toString('hex');
      scrypt(
        password.normalize('NFKC'),
        salt,
        64,
        { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
        (err, key) => {
          if (err) reject(err);
          else resolve(`${salt}:${key.toString('hex')}`);
        },
      );
    });
  }
}
