import {
  IsString, IsNotEmpty, IsBoolean, IsOptional, IsArray, ValidateNested,
  IsInt, Min, IsEnum, IsNumber, IsDateString, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RoundingModeDto {
  NORMAL = 'NORMAL',
  FLOOR = 'FLOOR',
  CEILING = 'CEILING',
  NONE = 'NONE',
}

export class PayStructureComponentDto {
  @ApiProperty({ description: 'Pay head ID' })
  @IsString()
  @IsNotEmpty()
  headId: string;

  @ApiPropertyOptional({ description: 'Formula expression', example: 'CTC * 0.5' })
  @IsString()
  @IsOptional()
  formula?: string;

  @ApiPropertyOptional({ description: 'Human-readable formula display', example: 'CTC × 50%' })
  @IsString()
  @IsOptional()
  formulaDisplay?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isVariable?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  showOnPayslip?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  hasArrear?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  hasIncrPct?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  affectsPf?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  affectsEsi?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  affectsPt?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  affectsGratuity?: boolean;

  @ApiPropertyOptional({ enum: RoundingModeDto, default: 'NORMAL' })
  @IsEnum(RoundingModeDto)
  @IsOptional()
  roundingMode?: RoundingModeDto;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  roundingPrecision?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class CreatePayStructureDto {
  @ApiProperty({ example: 'Standard India CTC Structure' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiProperty({ type: [PayStructureComponentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayStructureComponentDto)
  components: PayStructureComponentDto[];
}

export class UpdatePayStructureDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [PayStructureComponentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayStructureComponentDto)
  @IsOptional()
  components?: PayStructureComponentDto[];
}

export class AssignPayStructureDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  ctcAnnual?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  ctcMonthly?: number;

  @ApiProperty()
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  effectiveTo?: string;
}

export class ValidateFormulaDto {
  @ApiProperty({ example: 'CTC * 0.5' })
  @IsString()
  @IsNotEmpty()
  formula: string;

  @ApiPropertyOptional({ description: 'Pay head codes available for reference', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  availableHeadCodes?: string[];
}

export class PreviewCalculationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({ description: 'Monthly CTC amount' })
  @IsNumber()
  ctcMonthly: number;

  @ApiPropertyOptional({ default: 26 })
  @IsInt()
  @Min(1)
  @IsOptional()
  totalDays?: number;

  @ApiPropertyOptional({ default: 26 })
  @IsInt()
  @Min(0)
  @IsOptional()
  paidDays?: number;

  @ApiPropertyOptional({ description: 'Variable input overrides: { headCode: amount }' })
  @IsOptional()
  variableInputs?: Record<string, number>;
}
