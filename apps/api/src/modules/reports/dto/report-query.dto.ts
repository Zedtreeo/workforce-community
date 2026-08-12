import { IsOptional, IsString, IsDateString, IsNumberString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DateRangeQueryDto {
  @ApiProperty({ description: 'Start date (ISO 8601)', example: '2026-01-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date (ISO 8601)', example: '2026-01-31' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: 'Filter by employee ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  employeeId?: string;
}

export class AttendanceReportQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({ description: 'Filter by department ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  departmentId?: string;
}

export class BillingReportQueryDto {
  @ApiPropertyOptional({ description: 'Filter by year', example: '2026' })
  @IsOptional()
  @IsNumberString()
  year?: string;

  @ApiPropertyOptional({ description: 'Filter by client ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientId?: string;
}

export class LeaveSummaryQueryDto {
  @ApiPropertyOptional({ description: 'Filter by year', example: '2026' })
  @IsOptional()
  @IsNumberString()
  year?: string;

  @ApiPropertyOptional({ description: 'Filter by employee ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  employeeId?: string;
}
