// Atomic, per-tenant auto employee-code generator.
//
// Format: {PREFIX}{seq}   e.g. LE1178  (prefix from TenantLetterSettings)
//
// The next sequence is GREATEST(stored counter, highest numeric part of any
// existing employee_code for the tenant) + 1 — so it always continues above
// the last code already in the employee directory, even on first use or after
// manually-coded employees. Single UPDATE/RETURNING → atomic, no race.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma';

@Injectable()
export class EmployeeCodeService {
  private readonly logger = new Logger(EmployeeCodeService.name);
  constructor(private readonly prisma: PrismaService) {}

  async next(tenantId: string): Promise<string> {
    // Ensure a settings row exists (holds the prefix + counter).
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "tenant_letter_settings" (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING`,
      tenantId,
    );

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      WITH cur AS (
        SELECT COALESCE((counters ->> 'EMP')::bigint, 0) AS n, COALESCE(employee_code_prefix, 'LE') AS prefix
        FROM "tenant_letter_settings" WHERE tenant_id = $1 FOR UPDATE
      ),
      ex AS (
        -- highest numeric code among employees whose code matches THIS prefix
        -- (ignores other series like CL10001)
        SELECT COALESCE(MAX(NULLIF(regexp_replace(e.employee_code, '[^0-9]', '', 'g'), '')::bigint), 0) AS maxcode
        FROM "employees" e, cur
        WHERE e.tenant_id = $1 AND e.employee_code LIKE (cur.prefix || '%')
      )
      UPDATE "tenant_letter_settings" t
      SET counters = jsonb_set(
            COALESCE(t.counters, '{}'::jsonb),
            ARRAY['EMP'],
            to_jsonb(GREATEST(cur.n, ex.maxcode) + 1),
            true
          ),
          updated_at = CURRENT_TIMESTAMP
      FROM cur, ex
      WHERE t.tenant_id = $1
      RETURNING (GREATEST(cur.n, ex.maxcode) + 1) AS seq, cur.prefix AS prefix;
      `,
      tenantId,
    );
    if (!rows.length) {
      this.logger.error(`Employee-code counter increment failed for tenant=${tenantId}`);
      throw new Error('Employee-code generation failed');
    }
    const seq = Number(rows[0].seq);
    const prefix: string = rows[0].prefix || 'LE';
    const code = `${prefix}${seq}`;

    // Defensive: if a legacy code collides, bump until free (counter already advanced).
    const clash = await this.prisma.employee.findUnique({
      where: { tenantId_employeeCode: { tenantId, employeeCode: code } },
      select: { id: true },
    });
    if (clash) return this.next(tenantId);
    return code;
  }

  /** Read-only: what the next code would be, WITHOUT consuming the counter (for UI display). */
  async peek(tenantId: string): Promise<string> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      WITH cfg AS (
        SELECT COALESCE((SELECT employee_code_prefix FROM "tenant_letter_settings" WHERE tenant_id = $1), 'LE') AS prefix,
               COALESCE((SELECT (counters ->> 'EMP')::bigint FROM "tenant_letter_settings" WHERE tenant_id = $1), 0) AS n
      )
      SELECT (GREATEST(cfg.n, COALESCE(MAX(NULLIF(regexp_replace(e.employee_code, '[^0-9]', '', 'g'), '')::bigint), 0)) + 1) AS seq,
             cfg.prefix
      FROM cfg
      LEFT JOIN "employees" e ON e.tenant_id = $1 AND e.employee_code LIKE (cfg.prefix || '%')
      GROUP BY cfg.prefix, cfg.n;
      `,
      tenantId,
    );
    const seq = rows.length ? Number(rows[0].seq) : 1;
    const prefix = (rows.length && rows[0].prefix) || 'LE';
    return `${prefix}${seq}`;
  }
}
