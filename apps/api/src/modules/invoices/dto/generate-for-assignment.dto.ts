import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Generate ONE advance invoice for one OR MORE employees (assignments) of the
 * SAME client. Each selected employee becomes a line item; the invoice is raised
 * on the given date and covers each employee's upcoming month, payable on receipt.
 *
 * Provide `assignmentIds` (preferred, multi-select). `assignmentId` is still
 * accepted for backward compatibility and is merged into the set.
 */
export class GenerateForAssignmentDto {
  @ApiPropertyOptional({
    type: [String],
    example: ['clxyz789...', 'clabc123...'],
    description: 'EmployeeAssignment ids to bill on a single combined invoice (same client).',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  assignmentIds?: string[];

  @ApiPropertyOptional({ example: 'clxyz789...', description: 'Single EmployeeAssignment id (legacy). Merged into assignmentIds.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  assignmentId?: string;

  @ApiPropertyOptional({
    example: '2026-06-13',
    description:
      'Invoice/billing date. Defaults to today. Each employee’s advance service period runs one month from their billing day on/after this date.',
  })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @ApiPropertyOptional({ example: 18, description: 'Tax percentage (e.g. 18 for GST). Defaults to 0.' })
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
