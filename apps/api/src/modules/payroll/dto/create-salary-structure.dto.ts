import { IsString, IsNumber, IsOptional, IsDateString, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSalaryStructureDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  employeeId: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  effectiveTo?: string;

  @ApiProperty({ example: 50000, description: 'Basic salary' })
  @IsNumber()
  @Min(0)
  @Max(100000000)
  basic: number;

  @ApiPropertyOptional({ example: 20000 })
  @IsNumber()
  @Min(0)
  @Max(100000000)
  @IsOptional()
  hra?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsNumber()
  @Min(0)
  @Max(100000000)
  @IsOptional()
  da?: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsNumber()
  @Min(0)
  @Max(100000000)
  @IsOptional()
  specialAllow?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsNumber()
  @Min(0)
  @Max(100000000)
  @IsOptional()
  otherAllow?: number;

  @ApiPropertyOptional({ description: 'Employee PF contribution (auto-calculated if omitted)' })
  @IsNumber()
  @Min(0)
  @Max(100000000)
  @IsOptional()
  pfEmployee?: number;

  @ApiPropertyOptional({ description: 'Employer PF contribution' })
  @IsNumber()
  @Min(0)
  @Max(100000000)
  @IsOptional()
  pfEmployer?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(100000000)
  @IsOptional()
  esiEmployee?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(100000000)
  @IsOptional()
  esiEmployer?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(100000000)
  @IsOptional()
  profTax?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(100000000)
  @IsOptional()
  tds?: number;
}
