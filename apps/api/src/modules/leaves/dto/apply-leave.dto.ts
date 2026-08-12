import { IsString, IsNumber, IsOptional, IsDateString, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplyLeaveDto {
  @ApiProperty({ description: 'Employee ID' })
  @IsString()
  @MaxLength(100)
  employeeId: string;

  @ApiProperty({ description: 'Leave type ID' })
  @IsString()
  @MaxLength(100)
  leaveTypeId: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-06-03' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 2.5, description: 'Number of leave days (min 0.5 for half-day)' })
  @IsNumber()
  @Min(0.5)
  @Max(365)
  days: number;

  @ApiPropertyOptional({ example: 'Family event', description: 'Reason for leave' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
