import { IsString, IsNumber, IsOptional, IsDateString, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PortalApplyLeaveDto {
  @ApiProperty({ description: 'Leave type ID' })
  @IsString()
  @MaxLength(100)
  leaveTypeId: string;

  @ApiProperty({ description: 'Start date (ISO string)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date (ISO string)' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Number of leave days (min 0.5 for half-day)' })
  @IsNumber()
  @Min(0.5)
  @Max(365)
  days: number;

  @ApiPropertyOptional({ description: 'Reason for leave' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AttendanceCorrectionDto {
  @ApiProperty({ description: 'Date to correct (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Requested attendance status' })
  @IsString()
  @MaxLength(50)
  requestedStatus: string;

  @ApiProperty({ description: 'Reason for correction' })
  @IsString()
  @MaxLength(500)
  reason: string;
}
