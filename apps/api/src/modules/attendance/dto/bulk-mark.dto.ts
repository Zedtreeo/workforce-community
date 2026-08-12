import { IsArray, ValidateNested, IsDateString, IsString, IsEnum, IsOptional, MaxLength, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';

export class BulkAttendanceItemDto {
  @ApiProperty({ example: 'clxyz123...' })
  @IsString()
  @MaxLength(100)
  employeeId: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class BulkMarkAttendanceDto {
  @ApiProperty({ example: '2026-04-16' })
  @IsDateString()
  date: string;

  @ApiProperty({ type: [BulkAttendanceItemDto] })
  @IsArray()
  @ArrayMaxSize(500, { message: 'Maximum 500 entries per batch' })
  @ValidateNested({ each: true })
  @Type(() => BulkAttendanceItemDto)
  entries: BulkAttendanceItemDto[];
}
