// apps/api/src/modules/letters/services/variable-resolver.service.ts
//
// Builds the variable map (data object) passed to docxtemplater/Carbone for
// each letter type. Pulls Employee, SalaryStructure, EmployeeAssignment,
// Client, Tenant, and TenantLetterSettings as needed.
//
// Output is a FLAT object with keys matching the {placeholder} names in the
// .docx templates. Dates are pre-formatted strings (template authors don't
// have to format inside Word).
//
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { LetterType } from '@prisma/client';

// Common client countries for the offer-letter "Client Country" picker.
const COUNTRY_OPTIONS = [
  'USA', 'United Kingdom', 'Canada', 'Australia', 'India', 'UAE', 'Saudi Arabia',
  'Qatar', 'Singapore', 'Germany', 'Netherlands', 'Ireland', 'France', 'Spain',
  'Italy', 'Switzerland', 'Sweden', 'New Zealand', 'South Africa', 'Japan',
];

export interface ResolveParams {
  type: LetterType;
  employeeId?: string;
  clientId?: string;
  assignmentId?: string;
}

export interface ResolvedContext {
  /** The fully resolved variable map. */
  data: Record<string, any>;
  /** Which fields the admin can override in the UI. */
  editableFields: EditableField[];
}

export interface EditableField {
  key: string;          // dotted path matching data shape, e.g. "issueDate" or "salary.basicMonthly"
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'select';
  options?: string[];   // for select
  required?: boolean;
}

@Injectable()
export class VariableResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(tenantId: string, params: ResolveParams): Promise<ResolvedContext> {
    switch (params.type) {
      case 'OFFER_LETTER':       return this.resolveOffer(tenantId, params);
      case 'APPOINTMENT_LETTER': return this.resolveAppointment(tenantId, params);
      case 'EXPERIENCE_LETTER':  return this.resolveExperience(tenantId, params);
      case 'CLIENT_AGREEMENT':   return this.resolveAgreement(tenantId, params);
      default:
        throw new NotFoundException(`Unsupported letter type: ${params.type}`);
    }
  }

  // ─────────── OFFER LETTER ───────────
  private async resolveOffer(tenantId: string, p: ResolveParams): Promise<ResolvedContext> {
    if (!p.employeeId) throw new NotFoundException('employeeId required for OFFER_LETTER');
    const emp = await this.loadEmployee(tenantId, p.employeeId);
    const salary = await this.loadActiveSalary(tenantId, emp.id);
    const tenant = await this.loadTenant(tenantId);
    const settings = await this.getOrCreateSettings(tenantId);
    const offer = await this.prisma.offerLetter.findUnique({ where: { employeeId: emp.id } });
    const offerAssignment = await this.prisma.employeeAssignment.findFirst({
      where: { tenantId, employeeId: emp.id, status: 'ACTIVE' },
      include: { client: { select: { country: true } } },
    });

    const data = {
      issueDate: this.fmtDate(new Date()),
      employee: {
        firstName: emp.firstName,
        lastName: emp.lastName,
        fullName: `${emp.firstName} ${emp.lastName}`,
        email: emp.email,
        address: '',                    // Employee.address not stored; admin fills
        designation: offer?.designation ?? emp.designation ?? '',
        joiningDate: this.fmtDate(offer?.joiningDate ?? emp.joinDate),
      },
      probationDays: offer?.probationMonths ? offer.probationMonths * 30 : settings.defaultProbationDays,
      workingHours: offer?.workSchedule ?? settings.defaultWorkingHours,
      workLocation: offer?.workLocation ?? settings.defaultLocation,
      employmentType: offer?.employmentType === 'PART_TIME' ? 'Part Time' : 'Full Time',
      clientCountry: offerAssignment?.client?.country || 'USA', // default for not-yet-assigned hires; editable in the dialog
      salary: this.formatSalary(salary, emp.salary),
      tenant: { name: tenant.name, signatoryName: settings.signatoryName ?? '', signatoryTitle: settings.signatoryTitle ?? '' },
    };

    const editableFields: EditableField[] = [
      { key: 'issueDate',                label: 'Issue Date',        type: 'date',     required: true },
      { key: 'employee.address',         label: 'Address',           type: 'textarea' },
      { key: 'employee.designation',     label: 'Designation',       type: 'text',     required: true },
      { key: 'employee.joiningDate',     label: 'Joining Date',      type: 'date',     required: true },
      { key: 'probationDays',            label: 'Probation (days)',  type: 'number' },
      { key: 'workingHours',             label: 'Working Hours',     type: 'text' },
      { key: 'workLocation',             label: 'Work Location',     type: 'text' },
      { key: 'employmentType',           label: 'Employment Type',   type: 'select', options: ['Full Time', 'Part Time'] },
      { key: 'clientCountry',            label: 'Client Country',    type: 'select', options: COUNTRY_OPTIONS },
      { key: 'salary.basicMonthly',      label: 'Basic (Monthly)',   type: 'number' },
      { key: 'salary.hraMonthly',        label: 'HRA (Monthly)',     type: 'number' },
      { key: 'salary.specialMonthly',    label: 'Special (Monthly)', type: 'number' },
      { key: 'salary.grossMonthly',      label: 'Gross (Monthly)',   type: 'number' },
      { key: 'salary.ctcAnnual',         label: 'CTC (Annual)',      type: 'number' },
    ];

    return { data, editableFields };
  }

  // ─────────── APPOINTMENT LETTER ───────────
  private async resolveAppointment(tenantId: string, p: ResolveParams): Promise<ResolvedContext> {
    if (!p.employeeId) throw new NotFoundException('employeeId required for APPOINTMENT_LETTER');
    const emp = await this.loadEmployee(tenantId, p.employeeId);
    const salary = await this.loadActiveSalary(tenantId, emp.id);
    const tenant = await this.loadTenant(tenantId);
    const settings = await this.getOrCreateSettings(tenantId);
    const apptOffer = await this.prisma.offerLetter.findUnique({ where: { employeeId: emp.id } });
    const apptAssignment = await this.prisma.employeeAssignment.findFirst({
      where: { tenantId, employeeId: emp.id, status: 'ACTIVE' },
      select: { role: true },
    });
    const apptDesignation = emp.designation || apptOffer?.designation || apptAssignment?.role || '';

    const data = {
      offerReleaseDate: this.fmtDate(new Date()),
      employee: {
        fullName: `${emp.firstName} ${emp.lastName}`,
        address: '',
        designation: apptDesignation,
        joiningDate: this.fmtDate(emp.joinDate),
      },
      location: settings.defaultLocation,
      employmentType: 'Full Time',
      workingHoursBlock: settings.defaultWorkingHours,
      probationDays: settings.defaultProbationDays,
      salary: this.formatSalary(salary, emp.salary),
      tenant: { name: tenant.name, signatoryName: settings.signatoryName ?? '', signatoryTitle: settings.signatoryTitle ?? '' },
    };

    const editableFields: EditableField[] = [
      { key: 'offerReleaseDate',     label: 'Offer Release Date', type: 'date', required: true },
      { key: 'employee.address',     label: 'Address',            type: 'textarea' },
      { key: 'employee.designation', label: 'Designation',        type: 'text', required: true },
      { key: 'employee.joiningDate', label: 'Joining Date',       type: 'date', required: true },
      { key: 'location',             label: 'Work Location',      type: 'text' },
      { key: 'employmentType',       label: 'Employment Type',    type: 'select', options: ['Full Time', 'Part Time', 'Contract'] },
      { key: 'workingHoursBlock',    label: 'Working Hours',      type: 'textarea' },
      { key: 'probationDays',        label: 'Probation (days)',   type: 'number' },
      { key: 'salary.basicMonthly',  label: 'Basic (Monthly)',    type: 'number' },
      { key: 'salary.hraMonthly',    label: 'HRA (Monthly)',      type: 'number' },
      { key: 'salary.specialMonthly',label: 'Special (Monthly)',  type: 'number' },
      { key: 'salary.grossMonthly',  label: 'Gross (Monthly)',    type: 'number' },
      { key: 'salary.ctcAnnual',     label: 'CTC (Annual)',       type: 'number' },
    ];

    return { data, editableFields };
  }

  // ─────────── EXPERIENCE & RELIEVING ───────────
  private async resolveExperience(tenantId: string, p: ResolveParams): Promise<ResolvedContext> {
    if (!p.employeeId) throw new NotFoundException('employeeId required for EXPERIENCE_LETTER');
    const emp = await this.loadEmployee(tenantId, p.employeeId);
    const tenant = await this.loadTenant(tenantId);
    const settings = await this.getOrCreateSettings(tenantId);

    const data = {
      issueDate: this.fmtDate(new Date()),
      employee: {
        fullName: `${emp.firstName} ${emp.lastName}`,
        designation: emp.designation ?? '',
        joiningDate: this.fmtDate(emp.joinDate),
        exitDate: this.fmtDate(emp.exitDate ?? new Date()),
      },
      commendation:
        'During his/her tenure with us, the employee contributed significantly to various projects and initiatives. ' +
        'His/her dedication, professionalism, and commitment to excellence have made a positive impact on our organization.',
      tenant: { name: tenant.name, signatoryName: settings.signatoryName ?? '', signatoryTitle: settings.signatoryTitle ?? '' },
    };

    const editableFields: EditableField[] = [
      { key: 'issueDate',            label: 'Issue Date',     type: 'date',     required: true },
      { key: 'employee.designation', label: 'Designation',    type: 'text',     required: true },
      { key: 'employee.joiningDate', label: 'Joining Date',   type: 'date',     required: true },
      { key: 'employee.exitDate',    label: 'Last Working Day', type: 'date',   required: true },
      { key: 'commendation',         label: 'Commendation Paragraph', type: 'textarea' },
    ];

    return { data, editableFields };
  }

  // ─────────── CLIENT AGREEMENT ───────────
  private async resolveAgreement(tenantId: string, p: ResolveParams): Promise<ResolvedContext> {
    if (!p.clientId && !p.assignmentId) throw new NotFoundException('clientId or assignmentId required for CLIENT_AGREEMENT');

    // Locate the assignment(s)
    let client: any;
    let assignments: any[];
    if (p.assignmentId) {
      const a = await this.prisma.employeeAssignment.findFirst({
        where: { id: p.assignmentId, tenantId },
        include: {
          client: true,
          employee: { select: { firstName: true, lastName: true } },
        },
      });
      if (!a) throw new NotFoundException('Assignment not found');
      client = a.client;
      assignments = [a];
    } else {
      client = await this.prisma.client.findFirst({
        where: { id: p.clientId, tenantId, deletedAt: null },
      });
      if (!client) throw new NotFoundException('Client not found');
      assignments = await this.prisma.employeeAssignment.findMany({
        where: { tenantId, clientId: client.id, status: 'ACTIVE' },
        include: { employee: { select: { firstName: true, lastName: true } } },
      });
    }
    const tenant = await this.loadTenant(tenantId);
    const settings = await this.getOrCreateSettings(tenantId);

    const employeeNames = assignments.map((a: any) => `${a.employee.firstName} ${a.employee.lastName}`).join(', ');
    const positions = Array.from(new Set(assignments.map((a: any) => a.role).filter(Boolean))).join(', ');
    const firstAssignment = assignments[0];

    // Service type follows the assigned employee's shift: full-time (>=9h) vs part-time.
    let serviceType = settings.defaultWorkingHours;
    if (firstAssignment) {
      const es = await this.prisma.employeeShift.findFirst({
        where: { tenantId, employeeId: firstAssignment.employeeId, isActive: true },
        orderBy: { effectiveFrom: 'desc' },
        include: { shiftType: { select: { totalHours: true } } },
      });
      const hrs = es?.shiftType ? Number(es.shiftType.totalHours) : 9;
      serviceType = hrs >= 9 ? 'Full Time' : 'Part Time';
    }

    const data = {
      referenceNo: '',                                  // filled by ReferenceNumberService at generate time
      startDate: this.fmtDate(firstAssignment?.startDate ?? new Date()),
      client: {
        companyName: client.name,
        website: client.website ?? '',
        address: client.registeredAddress ?? '',
        country: client.country,
        signatoryName: client.signatoryName ?? '',
        contactNumber: client.contactNumber ?? '',
        email: client.email,
      },
      employeeNames,
      designatedWork: positions,
      serviceType,
      monthlyFee: firstAssignment ? Number(firstAssignment.billingRate) : 0,
      currency: firstAssignment?.currency ?? client.currency,
      noticePeriodDeposit: 'N/A',
      salaryIncrementTerms:
        'Salary Increment & revision fee will be mutually decided between both the parties which will include the employee\'s salary increment on completion of each 12 months.',
      tenant: { name: tenant.name, signatoryName: settings.signatoryName ?? '', signatoryTitle: settings.signatoryTitle ?? '' },
    };

    const editableFields: EditableField[] = [
      { key: 'startDate',            label: 'Start Date',                  type: 'date',     required: true },
      { key: 'client.companyName',   label: 'Client Company Name',         type: 'text',     required: true },
      { key: 'client.website',       label: 'Client Website',              type: 'text' },
      { key: 'client.address',       label: 'Client Registered Address',   type: 'textarea' },
      { key: 'client.signatoryName', label: 'Authorized Signatory',        type: 'text' },
      { key: 'client.contactNumber', label: 'Contact Number',              type: 'text' },
      { key: 'client.email',         label: 'Email',                       type: 'text' },
      { key: 'employeeNames',        label: 'Employee Name(s)',            type: 'textarea' },
      { key: 'designatedWork',       label: 'Designated Work / Position',  type: 'text' },
      { key: 'serviceType',          label: 'Service Type / Working Hours', type: 'text' },
      { key: 'monthlyFee',           label: 'Monthly Fee',                 type: 'number',  required: true },
      { key: 'currency',             label: 'Currency',                    type: 'text' },
      { key: 'noticePeriodDeposit',  label: 'Notice Period Deposit',       type: 'text' },
      { key: 'salaryIncrementTerms', label: 'Salary Increment Terms',      type: 'textarea' },
    ];

    return { data, editableFields };
  }

  // ─────────── helpers ───────────
  private async loadEmployee(tenantId: string, id: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!emp) throw new NotFoundException('Employee not found');
    return emp;
  }

  private async loadActiveSalary(tenantId: string, employeeId: string) {
    return this.prisma.salaryStructure.findFirst({
      where: { tenantId, employeeId, isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  private async loadTenant(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!t) throw new NotFoundException('Tenant not found');
    return t;
  }

  async getOrCreateSettings(tenantId: string) {
    const existing = await this.prisma.tenantLetterSettings.findUnique({ where: { tenantId } });
    if (existing) return existing;
    return this.prisma.tenantLetterSettings.create({ data: { tenantId } });
  }

  private formatSalary(salary: any | null, fallbackAnnual: any) {
    // ── No SalaryStructure: employee.salary is the ANNUAL gross/CTC (system-wide
    //    convention — payroll + onboarding both treat employee.salary as annual).
    //    Derive the monthly figure, then split Basic 50% / HRA 25% / Special 25%.
    if (!salary) {
      const grossAnnual    = Math.round(Number(fallbackAnnual ?? 0));
      const grossMonthly   = Math.round(grossAnnual / 12);
      const basicMonthly   = Math.round(grossMonthly * 0.50);
      const hraMonthly     = Math.round(grossMonthly * 0.25);
      const specialMonthly = grossMonthly - basicMonthly - hraMonthly;   // exact remainder
      return {
        basicMonthly,   basicAnnual:   basicMonthly   * 12,
        hraMonthly,     hraAnnual:     hraMonthly     * 12,
        specialMonthly, specialAnnual: specialMonthly * 12,
        grossMonthly,   grossAnnual,
        ctcMonthly:     grossMonthly,   // No employer contributions in fallback
        ctcAnnual:      grossAnnual,
        statutoryDeduction: 0,
        netMonthly:     grossMonthly,   netAnnual: grossAnnual,
      };
    }
    // ── Has SalaryStructure: use real values
    const basic   = Math.round(Number(salary.basic));
    const hra     = Math.round(Number(salary.hra ?? 0));
    const special = Math.round(Number(salary.specialAllow ?? 0));
    const gross   = Math.round(Number(salary.grossSalary));
    const ctc     = Math.round(Number(salary.ctc));
    return {
      basicMonthly:   basic,       basicAnnual:    basic * 12,
      hraMonthly:     hra,         hraAnnual:      hra * 12,
      specialMonthly: special,     specialAnnual:  special * 12,
      grossMonthly:   gross,       grossAnnual:    gross * 12,
      ctcMonthly:     Math.round(ctc / 12),  ctcAnnual: ctc,
      statutoryDeduction: 0,
      netMonthly:     gross,       netAnnual:     gross * 12,
    };
  }

  private fmtDate(d: Date | null | undefined): string {
    if (!d) return '';
    const dt = new Date(d);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${dt.getUTCDate()} ${months[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
  }
}
