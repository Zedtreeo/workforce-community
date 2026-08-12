import { IsString, IsBoolean, IsInt, IsOptional, Min, Max, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLeaveTypeDto {
  @ApiPropertyOptional({ example: 'Casual Leave' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  @ApiPropertyOptional({ example: 12 })
  @IsInt()
  @Min(0)
  @Max(365)
  @IsOptional()
  defaultDays?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  carryForward?: boolean;

  @ApiPropertyOptional({ example: 5 })
  @IsInt()
  @Min(0)
  @Max(365)
  @IsOptional()
  maxCarryDays?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
