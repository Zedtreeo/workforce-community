import { IsString, IsOptional, IsDateString, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MarkPaidDto {
  @ApiPropertyOptional({ example: '2026-05-20', description: 'Payment date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiProperty({ example: '3500.00' })
  @IsString()
  @MaxLength(20)
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'Paid amount must be a valid decimal (e.g., 3500.00)' })
  paidAmount: string;

  @ApiPropertyOptional({ example: 'PAY-TXN-123456', description: 'Payoneer transaction ref' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentRef?: string;
}
