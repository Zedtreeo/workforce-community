// apps/api/src/modules/letters/services/reference-number.service.ts
//
// Per-tenant, per-type, year-prefixed counters with atomic increment.
//
// Format: {PREFIX}/{YY}/{TYPE_CODE}/{seq:5}    e.g. LEGELP/ZT/26/OFF/00042
//
// Concurrency strategy: jsonb_set with a single UPDATE/RETURNING so the
// increment is atomic at the row level. No SELECT-then-UPDATE race.
//
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { LetterType } from '@prisma/client';

const TYPE_CODES: Record<LetterType, string> = {
  OFFER_LETTER:       'OFF',
  APPOINTMENT_LETTER: 'APP',
  EXPERIENCE_LETTER:  'EXP',
  CLIENT_AGREEMENT:   'AGR',
};

@Injectable()
export class ReferenceNumberService {
  private readonly logger = new Logger(ReferenceNumberService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically increment + return the next sequence for (tenant, year, type).
   * Returns e.g. "LEGELP/ZT/26/OFF/00042".
   */
  async next(tenantId: string, type: LetterType, opts: { override?: string | null } = {}): Promise<string> {
    if (opts.override && opts.override.trim()) return opts.override.trim();

    const year = new Date().getUTCFullYear();
    const yearStr = String(year);
    // Third segment is the 2-digit month (shared monthly sequence across letter types).
    const month = String(new Date().getUTCMonth() + 1).padStart(2, '0');

    // Ensure settings row exists
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "tenant_letter_settings" (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING`,
      tenantId,
    );

    // Atomic increment via jsonb_set on counters.{year}.{typeCode}
    // Postgres jsonb_set with create_missing=true makes the path on first use.
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      WITH cur AS (
        SELECT COALESCE(
          (counters -> $2 ->> $3)::int, 0
        ) AS n, ref_number_prefix
        FROM "tenant_letter_settings"
        WHERE tenant_id = $1
        FOR UPDATE
      )
      UPDATE "tenant_letter_settings" t
      SET counters = jsonb_set(
            jsonb_set(
              COALESCE(t.counters, '{}'::jsonb),
              ARRAY[$2],
              COALESCE(t.counters -> $2, '{}'::jsonb),
              true
            ),
            ARRAY[$2, $3],
            to_jsonb((cur.n + 1)::int),
            true
          ),
          updated_at = CURRENT_TIMESTAMP
      FROM cur
      WHERE t.tenant_id = $1
      RETURNING cur.n + 1 AS seq, cur.ref_number_prefix AS prefix;
      `,
      tenantId, yearStr, month,
    );

    if (!rows.length) {
      this.logger.error(`Failed to increment counter for tenant=${tenantId} type=${type}`);
      throw new Error('Reference-number counter increment failed');
    }
    const { seq, prefix } = rows[0];
    const yy = String(year).slice(-2);
    return `${prefix}/${yy}/${month}/${String(seq).padStart(5, '0')}`;
  }

  /** Read-only: the reference number the next generate WOULD assign (no increment). For previews. */
  async peek(tenantId: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const yy = String(year).slice(-2);
    const month = String(new Date().getUTCMonth() + 1).padStart(2, '0');
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE((counters -> $2 ->> $3)::int, 0) AS n, ref_number_prefix AS prefix
       FROM "tenant_letter_settings" WHERE tenant_id = $1`,
      tenantId, String(year), month,
    );
    const n = rows.length ? Number(rows[0].n) : 0;
    const prefix = (rows.length && rows[0].prefix) || 'LEGELP/ZT';
    return `${prefix}/${yy}/${month}/${String(n + 1).padStart(5, '0')}`;
  }
}
