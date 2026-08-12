import { IsString, IsInt, IsOptional, Min, Max, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class InitBalancesDto {
  @ApiPropertyOptional({ description: 'Employee ID (omit to init for ALL active employees)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  employeeId?: string;

  @ApiPropertyOptional({ example: 2026, description: 'Year (defaults to current year)' })
  @IsInt()
  @Min(2020)
  @Max(2100)
  @IsOptional()
  year?: number;
}
