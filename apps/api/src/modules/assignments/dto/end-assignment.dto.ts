import { IsDateString, IsOptional, IsString, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentStatus } from '@prisma/client';

export class EndAssignmentDto {
  @ApiProperty({ example: '2026-10-31' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    enum: AssignmentStatus,
    example: AssignmentStatus.COMPLETED,
    default: AssignmentStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
