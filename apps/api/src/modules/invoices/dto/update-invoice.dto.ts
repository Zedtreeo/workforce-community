import { IsString, IsOptional, IsDateString, IsNumber, IsEnum, Min, Max, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ example: '2026-05-15' })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: '2026-07-02', description: 'Billing period start' })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({ example: '2026-08-01', description: 'Billing period end' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional()
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  paymentTerms?: string;

  @ApiPropertyOptional({ example: 'https://payoneer.com/pay/abc123', description: 'Per-invoice Payoneer payment link' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  payoneerLink?: string;

  @ApiPropertyOptional({ description: 'Issuing legal entity — switching renumbers into that entity\'s series' })
  @IsOptional()
  @IsString()
  billingEntityId?: string;
}
