import { IsOptional, IsDateString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Inputs for cloning an existing invoice into a new DRAFT.
 * Always gets a fresh auto-incremented invoice number; payment state is cleared.
 */
export class DuplicateInvoiceDto {
  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Invoice date for the new draft. Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @ApiPropertyOptional({
    enum: ['same', 'this', 'next'],
    default: 'next',
    description:
      "Billing period for the clone: 'same' = copy the original period verbatim; " +
      "'this' = shift to the invoice-date month; 'next' = shift to the following month. " +
      'For assignment-linked lines the period label in the description is regenerated to match.',
  })
  @IsOptional()
  @IsIn(['same', 'this', 'next'])
  periodMonth?: 'same' | 'this' | 'next';
}
