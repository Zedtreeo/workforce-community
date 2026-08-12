// apps/api/src/modules/attendance/dto/import-attendance.dto.ts
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ImportAttendanceDto {
  @ApiPropertyOptional({
    description:
      'When true, parse + validate only — no DB writes. Returns batch with errors so admin can review before committing.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  dryRun?: boolean = false;
}

export interface ImportRowError {
  row: number;                  // 1-indexed CSV row (excluding header)
  employee_email?: string;
  date?: string;
  message: string;
}

export interface ImportBatchResponse {
  batchId: string;
  status: 'PENDING' | 'COMMITTED' | 'FAILED';
  dryRun: boolean;
  rowCount: number;
  successCount: number;
  errorCount: number;
  errors: ImportRowError[];
}
