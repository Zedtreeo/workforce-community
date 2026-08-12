import { IsString, IsOptional, IsEnum, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Plan } from '@prisma/client';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'acme-corp', description: 'URL-friendly slug, lowercase with hyphens' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase alphanumeric with hyphens only' })
  slug: string;

  @ApiPropertyOptional({ example: 'acme.hrms.app' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/, { message: 'Domain must be a valid hostname' })
  domain?: string;

  @ApiPropertyOptional({ enum: Plan, default: Plan.STARTER })
  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;

  @ApiPropertyOptional({ example: 'INR', default: 'INR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata', default: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @ApiPropertyOptional({ example: '29ABCDE1234F1ZH' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  @Matches(/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d][A-Z]$/, { message: 'GST number must be in valid GSTIN format' })
  gstNumber?: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^[A-Z]{5}\d{4}[A-Z]$/, { message: 'PAN must be in format ABCDE1234F' })
  panNumber?: string;
}
