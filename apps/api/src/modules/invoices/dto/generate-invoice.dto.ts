import { IsString, IsOptional, IsDateString, IsNumber, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateInvoiceDto {
  @ApiProperty({ example: 'clxyz456...' })
  @IsString()
  @MaxLength(100)
  clientId: string;

  @ApiProperty({ example: 2026, description: 'Billing period year' })
  @IsNumber()
  @Min(2020)
  @Max(2100)
  year: number;

  @ApiProperty({ example: 4, description: 'Billing period month (1-12)' })
  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @ApiPropertyOptional({ example: '2026-05-15', description: 'Invoice date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @ApiPropertyOptional({ example: 30, description: 'Payment terms in days (defaults to 15)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  dueDays?: number;

  @ApiPropertyOptional({ example: 18, description: 'Tax percentage (e.g. 18 for GST)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
