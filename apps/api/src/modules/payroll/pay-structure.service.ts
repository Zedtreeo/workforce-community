import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CreatePayHeadDto, UpdatePayHeadDto } from './dto/pay-head.dto';
import {
  CreatePayStructureDto, UpdatePayStructureDto, AssignPayStructureDto,
  PreviewCalculationDto,
} from './dto/pay-structure.dto';
import {
  calculatePayStructure, validateFormula, getDependencyGraph,
  PayComponent, CalculationInput,
} from './formula-engine';

@Injectable()
export class PayStructureService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════
  // PAY HEADS
  // ═══════════════════════════════════════════════════

  async getPayHeads(tenantId: string, params?: { type?: string; isActive?: boolean }) {
    return this.prisma.payHead.findMany({
      where: {
        tenantId,
        ...(params?.type && { type: params.type as any }),
        ...(params?.isActive !== undefined && { isActive: params.isActive }),
      },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getPayHead(tenantId: string, id: string) {
    const head = await this.prisma.payHead.findFirst({ where: { id, tenantId } });
    if (!head) throw new NotFoundException('Pay head not found');
    return head;
  }

  async createPayHead(tenantId: string, dto: CreatePayHeadDto) {
    // Check code uniqueness
    const existing = await this.prisma.payHead.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existing) throw new ConflictException(`Pay head with code '${dto.code}' already exists`);

    return this.prisma.payHead.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        type: dto.type as any,
        category: (dto.category as any) || 'FIXED',
        description: dto.description,
        isStatutory: dto.isStatutory || false,
        statutoryType: dto.statutoryType as any,
        sortOrder: dto.sortOrder || 0,
      },
    });
  }

  async updatePayHead(tenantId: string, id: string, dto: UpdatePayHeadDto) {
    await this.getPayHead(tenantId, id);
    return this.prisma.payHead.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deletePayHead(tenantId: string, id: string) {
    const head = await this.getPayHead(tenantId, id);

    // Check if head is used in any structure
    const usageCount = await this.prisma.payStructureComponent.count({
      where: { headId: id },
    });
    if (usageCount > 0) {
      throw new BadRequestException(
        `Cannot delete pay head '${head.name}' — it is used in ${usageCount} pay structure(s). Deactivate it instead.`,
      );
    }

    await this.prisma.payHead.delete({ where: { id } });
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════
  // PAY STRUCTURE TEMPLATES
  // ═══════════════════════════════════════════════════

  async getPayStructures(tenantId: string, params?: { isActive?: boolean }) {
    return this.prisma.payStructureTemplate.findMany({
      where: {
        tenantId,
        ...(params?.isActive !== undefined && { isActive: params.isActive }),
      },
      include: {
        components: {
          include: { head: { select: { name: true, code: true, type: true, category: true } } },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { assignments: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getPayStructure(tenantId: string, id: string) {
    const structure = await this.prisma.payStructureTemplate.findFirst({
      where: { id, tenantId },
      include: {
        components: {
          include: { head: true },
          orderBy: { sortOrder: 'asc' },
        },
        assignments: {
          where: { isActive: true },
          include: {
            employee: {
              select: { firstName: true, lastName: true, employeeCode: true, designation: true },
            },
          },
        },
      },
    });
    if (!structure) throw new NotFoundException('Pay structure not found');
    return structure;
  }

  async createPayStructure(tenantId: string, dto: CreatePayStructureDto) {
    // Check name uniqueness
    const existing = await this.prisma.payStructureTemplate.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Pay structure '${dto.name}' already exists`);

    // Validate all head IDs exist
    const headIds = dto.components.map((c) => c.headId);
    const heads = await this.prisma.payHead.findMany({
      where: { id: { in: headIds }, tenantId },
    });
    if (heads.length !== headIds.length) {
      const found = new Set(heads.map((h) => h.id));
      const missing = headIds.filter((id) => !found.has(id));
      throw new BadRequestException(`Pay head(s) not found: ${missing.join(', ')}`);
    }

    // Validate formulas
    const headCodeMap = new Map(heads.map((h) => [h.id, h.code]));
    const allCodes = heads.map((h) => h.code);

    for (const comp of dto.components) {
      if (comp.formula) {
        const error = validateFormula(comp.formula, allCodes);
        if (error) {
          const headCode = headCodeMap.get(comp.headId) || comp.headId;
          throw new BadRequestException(`Invalid formula for '${headCode}': ${error}`);
        }
      }
    }

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.payStructureTemplate.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.payStructureTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        isDefault: dto.isDefault || false,
        components: {
          create: dto.components.map((c) => ({
            headId: c.headId,
            formula: c.formula || null,
            formulaDisplay: c.formulaDisplay || null,
            isVariable: c.isVariable || false,
            showOnPayslip: c.showOnPayslip !== false,
            hasArrear: c.hasArrear || false,
            hasIncrPct: c.hasIncrPct || false,
            affectsPf: c.affectsPf || false,
            affectsEsi: c.affectsEsi || false,
            affectsPt: c.affectsPt || false,
            affectsGratuity: c.affectsGratuity || false,
            roundingMode: (c.roundingMode as any) || 'NORMAL',
            roundingPrecision: c.roundingPrecision ?? 0,
            sortOrder: c.sortOrder ?? 0,
          })),
        },
      },
      include: {
        components: {
          include: { head: { select: { name: true, code: true, type: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async updatePayStructure(tenantId: string, id: string, dto: UpdatePayStructureDto) {
    await this.getPayStructure(tenantId, id);

    // If updating components, delete old ones and recreate
    if (dto.components && dto.components.length > 0) {
      const comps = dto.components;
      const headIds = comps.map((c: any) => c.headId);
      const heads = await this.prisma.payHead.findMany({
        where: { id: { in: headIds }, tenantId },
      });

      // Validate formulas
      const allCodes = heads.map((h: any) => h.code);
      const headCodeMap = new Map(heads.map((h: any) => [h.id, h.code]));
      for (const comp of comps) {
        if (comp.formula) {
          const error = validateFormula(comp.formula, allCodes);
          if (error) {
            const headCode = headCodeMap.get(comp.headId) || comp.headId;
            throw new BadRequestException(`Invalid formula for '${headCode}': ${error}`);
          }
        }
      }

      await this.prisma.$transaction(async (tx) => {
        // Delete existing components
        await tx.payStructureComponent.deleteMany({ where: { templateId: id } });

        // Update template + create new components
        await tx.payStructureTemplate.update({
          where: { id },
          data: {
            ...(dto.name && { name: dto.name }),
            ...(dto.description !== undefined && { description: dto.description }),
            ...(dto.effectiveFrom && { effectiveFrom: new Date(dto.effectiveFrom) }),
            ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            components: {
              create: comps.map((c: any) => ({
                headId: c.headId,
                formula: c.formula || null,
                formulaDisplay: c.formulaDisplay || null,
                isVariable: c.isVariable || false,
                showOnPayslip: c.showOnPayslip !== false,
                hasArrear: c.hasArrear || false,
                hasIncrPct: c.hasIncrPct || false,
                affectsPf: c.affectsPf || false,
                affectsEsi: c.affectsEsi || false,
                affectsPt: c.affectsPt || false,
                affectsGratuity: c.affectsGratuity || false,
                roundingMode: (c.roundingMode as any) || 'NORMAL',
                roundingPrecision: c.roundingPrecision ?? 0,
                sortOrder: c.sortOrder ?? 0,
              })),
            },
          },
        });
      });
    } else {
      // Just update metadata
      if (dto.isDefault) {
        await this.prisma.payStructureTemplate.updateMany({
          where: { tenantId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      await this.prisma.payStructureTemplate.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.effectiveFrom && { effectiveFrom: new Date(dto.effectiveFrom) }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    }

    return this.getPayStructure(tenantId, id);
  }

  async deletePayStructure(tenantId: string, id: string) {
    const structure = await this.getPayStructure(tenantId, id);

    // Check for active assignments
    const activeAssignments = await this.prisma.payStructureAssignment.count({
      where: { templateId: id, isActive: true },
    });
    if (activeAssignments > 0) {
      throw new BadRequestException(
        `Cannot delete — ${activeAssignments} employee(s) are assigned to this structure. Reassign or deactivate first.`,
      );
    }

    // Cascade deletes components via schema
    await this.prisma.payStructureTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════
  // ASSIGNMENTS (Employee ↔ Pay Structure)
  // ═══════════════════════════════════════════════════

  async getAssignments(tenantId: string, params?: { employeeId?: string; isActive?: boolean }) {
    return this.prisma.payStructureAssignment.findMany({
      where: {
        tenantId,
        ...(params?.employeeId && { employeeId: params.employeeId }),
        ...(params?.isActive !== undefined && { isActive: params.isActive }),
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeCode: true, designation: true },
        },
        template: {
          select: { name: true, isDefault: true },
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async assignPayStructure(tenantId: string, dto: AssignPayStructureDto) {
    // Validate employee exists
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    // Validate template exists
    const template = await this.prisma.payStructureTemplate.findFirst({
      where: { id: dto.templateId, tenantId, isActive: true },
    });
    if (!template) throw new NotFoundException('Pay structure template not found or inactive');

    // Deactivate current active assignment
    await this.prisma.payStructureAssignment.updateMany({
      where: { tenantId, employeeId: dto.employeeId, isActive: true },
      data: { isActive: false, effectiveTo: new Date(dto.effectiveFrom) },
    });

    // Calculate monthly CTC if annual provided
    const ctcMonthly = dto.ctcMonthly ?? (dto.ctcAnnual ? dto.ctcAnnual / 12 : null);
    const ctcAnnual = dto.ctcAnnual ?? (dto.ctcMonthly ? dto.ctcMonthly * 12 : null);

    // Keep the employee's stored (annual) salary in sync with the assigned CTC,
    // so the Employee record always reflects the current pay structure.
    if (ctcAnnual != null) {
      await this.prisma.employee.update({
        where: { id: dto.employeeId },
        data: { salary: ctcAnnual },
      });
    }

    return this.prisma.payStructureAssignment.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        templateId: dto.templateId,
        ctcAnnual,
        ctcMonthly,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        template: { select: { name: true } },
      },
    });
  }

  // ═══════════════════════════════════════════════════
  // FORMULA VALIDATION & PREVIEW
  // ═══════════════════════════════════════════════════

  async validateFormula(tenantId: string, formula: string, headCodes?: string[]) {
    // If no head codes provided, get all active heads for tenant
    if (!headCodes || headCodes.length === 0) {
      const heads = await this.prisma.payHead.findMany({
        where: { tenantId, isActive: true },
        select: { code: true },
      });
      headCodes = heads.map((h) => h.code);
    }

    const error = validateFormula(formula, headCodes || []);
    return {
      valid: error === null,
      error: error || undefined,
    };
  }

  async previewCalculation(tenantId: string, dto: PreviewCalculationDto) {
    const template = await this.prisma.payStructureTemplate.findFirst({
      where: { id: dto.templateId, tenantId },
      include: {
        components: {
          include: { head: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!template) throw new NotFoundException('Pay structure template not found');

    const components: PayComponent[] = template.components.map((c) => ({
      headId: c.headId,
      headCode: c.head.code,
      headName: c.head.name,
      headType: c.head.type as 'EARNING' | 'DEDUCTION',
      formula: c.formula,
      isVariable: c.isVariable,
      showOnPayslip: c.showOnPayslip,
      hasArrear: c.hasArrear,
      affectsPf: c.affectsPf,
      affectsEsi: c.affectsEsi,
      affectsPt: c.affectsPt,
      affectsGratuity: c.affectsGratuity,
      roundingMode: c.roundingMode as any,
      roundingPrecision: c.roundingPrecision,
      sortOrder: c.sortOrder,
      isStatutory: c.head.isStatutory,
      statutoryType: c.head.statutoryType,
    }));

    const input: CalculationInput = {
      ctcMonthly: dto.ctcMonthly,
      totalDays: dto.totalDays || 26,
      paidDays: dto.paidDays ?? dto.totalDays ?? 26,
      variableInputs: dto.variableInputs,
    };

    try {
      const result = calculatePayStructure(components, input);
      return {
        templateName: template.name,
        ...result,
      };
    } catch (err: any) {
      throw new BadRequestException(`Calculation error: ${err.message}`);
    }
  }

  async getDependencyGraph(tenantId: string, templateId: string) {
    const template = await this.prisma.payStructureTemplate.findFirst({
      where: { id: templateId, tenantId },
      include: {
        components: {
          include: { head: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!template) throw new NotFoundException('Pay structure template not found');

    const components: PayComponent[] = template.components.map((c) => ({
      headId: c.headId,
      headCode: c.head.code,
      headName: c.head.name,
      headType: c.head.type as any,
      formula: c.formula,
      isVariable: c.isVariable,
      showOnPayslip: c.showOnPayslip,
      hasArrear: c.hasArrear,
      affectsPf: c.affectsPf,
      affectsEsi: c.affectsEsi,
      affectsPt: c.affectsPt,
      affectsGratuity: c.affectsGratuity,
      roundingMode: c.roundingMode as any,
      roundingPrecision: c.roundingPrecision,
      sortOrder: c.sortOrder,
      isStatutory: c.head.isStatutory,
      statutoryType: c.head.statutoryType,
    }));

    return getDependencyGraph(components);
  }

  // ═══════════════════════════════════════════════════
  // SEED DEFAULTS (India)
  // ═══════════════════════════════════════════════════

  async seedIndiaDefaults(tenantId: string) {
    const { INDIA_STATUTORY_HEADS, INDIA_DEFAULT_EARNING_HEADS } = await import('./formula-engine');

    // Create earning heads
    const earningHeads: Array<{ code: string; id: string }> = [];
    for (const head of INDIA_DEFAULT_EARNING_HEADS) {
      const created = await this.prisma.payHead.upsert({
        where: { tenantId_code: { tenantId, code: head.code } },
        create: {
          tenantId,
          name: head.name,
          code: head.code,
          type: head.type as any,
          category: head.category as any,
          sortOrder: head.sortOrder,
          description: head.description,
        },
        update: {},
      });
      earningHeads.push({ code: head.code, id: created.id });
    }

    // Create statutory heads
    const statutoryHeads: Array<{ code: string; id: string }> = [];
    for (const head of INDIA_STATUTORY_HEADS) {
      const created = await this.prisma.payHead.upsert({
        where: { tenantId_code: { tenantId, code: head.code } },
        create: {
          tenantId,
          name: head.name,
          code: head.code,
          type: head.type as any,
          category: 'STATUTORY',
          isStatutory: true,
          statutoryType: head.statutoryType as any,
          description: head.description,
          sortOrder: 100 + statutoryHeads.length,
        },
        update: {},
      });
      statutoryHeads.push({ code: head.code, id: created.id });
    }

    // Create default template
    const allHeads = [...earningHeads, ...statutoryHeads];
    const headMap = new Map(allHeads.map((h) => [h.code, h.id]));

    const allDefaults = [...INDIA_DEFAULT_EARNING_HEADS, ...INDIA_STATUTORY_HEADS];

    const template = await this.prisma.payStructureTemplate.upsert({
      where: { tenantId_name: { tenantId, name: 'Standard India CTC' } },
      create: {
        tenantId,
        name: 'Standard India CTC',
        description: 'Standard Indian CTC structure with PF, ESI, and PT',
        isDefault: true,
        components: {
          create: allDefaults.map((h, i) => ({
            headId: headMap.get(h.code)!,
            formula: h.formula,
            formulaDisplay: h.formulaDisplay,
            isVariable: false,
            showOnPayslip: h.code !== 'MGROSS', // MGross is intermediate
            affectsPf: 'affectsPf' in h ? h.affectsPf : false,
            affectsEsi: 'affectsEsi' in h ? h.affectsEsi : false,
            affectsPt: 'affectsPt' in h ? (h as any).affectsPt : false,
            affectsGratuity: 'affectsGratuity' in h ? (h as any).affectsGratuity : false,
            sortOrder: i,
          })),
        },
      },
      update: {},
      include: {
        components: {
          include: { head: { select: { name: true, code: true, type: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return {
      payHeads: allHeads.length,
      template: template.name,
      components: template.components.length,
    };
  }
}
