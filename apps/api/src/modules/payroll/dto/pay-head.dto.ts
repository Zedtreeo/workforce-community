import {
  IsString, IsNotEmpty, IsEnum, IsBoolean, IsOptional, IsInt, Min, MaxLength, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PayHeadTypeDto {
  EARNING = 'EARNING',
  DEDUCTION = 'DEDUCTION',
}

export enum PayHeadCategoryDto {
  FIXED = 'FIXED',
  VARIABLE = 'VARIABLE',
  STATUTORY = 'STATUTORY',
}

export enum StatutoryTypeDto {
  PF = 'PF',
  ESI = 'ESI',
  PT = 'PT',
  GRATUITY = 'GRATUITY',
  TDS = 'TDS',
}

export class CreatePayHeadDto {
  @ApiProperty({ example: 'Basic + DA' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'BASIC_DA' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  code: string;

  @ApiProperty({ enum: PayHeadTypeDto })
  @IsEnum(PayHeadTypeDto)
  type: PayHeadTypeDto;

  @ApiPropertyOptional({ enum: PayHeadCategoryDto, default: 'FIXED' })
  @IsEnum(PayHeadCategoryDto)
  @IsOptional()
  category?: PayHeadCategoryDto;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isStatutory?: boolean;

  @ApiPropertyOptional({ enum: StatutoryTypeDto })
  @IsEnum(StatutoryTypeDto)
  @IsOptional()
  statutoryType?: StatutoryTypeDto;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class UpdatePayHeadDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
