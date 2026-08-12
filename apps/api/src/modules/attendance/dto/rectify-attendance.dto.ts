// apps/api/src/modules/attendance/dto/rectify-attendance.dto.ts
// Used when admin EDITS an existing attendance row — reason is REQUIRED.
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';

export class RectifyAttendanceDto {
  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @ApiPropertyOptional({ example: '2026-05-20T09:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @ApiPropertyOptional({ example: '2026-05-20T18:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @ApiPropertyOptional({ example: 'Adjusted for biometric outage' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({
    example: 'Biometric device down; verified with security camera',
    description: 'Required justification — written to AuditLog.changes.reason',
  })
  @IsString()
  @MinLength(5, { message: 'Reason must be at least 5 characters' })
  @MaxLength(500)
  reason: string;
}
