import { IsString, IsDateString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignShiftDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  employeeId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  shiftTypeId: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  effectiveTo?: string;
}
