import { IsString, IsOptional, IsBoolean, IsArray, IsEnum, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum KbCategoryDto {
  GUIDE = 'GUIDE',
  FAQ = 'FAQ',
  POLICY = 'POLICY',
  COMPLIANCE = 'COMPLIANCE',
  TROUBLESHOOTING = 'TROUBLESHOOTING',
}

export class CreateKbArticleDto {
  @ApiProperty({ example: 'salary-structure-explained' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  slug: string;

  @ApiProperty({ example: 'How Salary Structure Works in HRMS' })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  title: string;

  @ApiProperty({ example: '## Overview\nSalary structure defines...' })
  @IsString()
  @MinLength(10)
  content: string;

  @ApiPropertyOptional({ example: 'Learn how salary components are calculated and assigned to employees.' })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiProperty({ example: 'payroll' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  module: string;

  @ApiPropertyOptional({ enum: KbCategoryDto, default: KbCategoryDto.GUIDE })
  @IsOptional()
  @IsEnum(KbCategoryDto)
  category?: KbCategoryDto;

  @ApiPropertyOptional({ example: ['salary', 'ctc', 'payroll'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
