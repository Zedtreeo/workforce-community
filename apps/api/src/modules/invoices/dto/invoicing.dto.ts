// apps/api/src/modules/invoices/dto/invoicing.dto.ts
import {
  IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsEmail,
  Min, MaxLength, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class RecordPaymentDto {
  @ApiProperty({ example: '2026-05-15' })
  @IsDateString()
  paidOn: string;

  @ApiProperty({ example: 1500.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @MaxLength(3)
  currency: string;

  @ApiPropertyOptional({ example: 83.20, description: 'Required when payment currency != invoice currency' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  exchangeRate?: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.PAYONEER })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({ example: 'PYR-2026-12345' })
  @IsOptional() @IsString() @MaxLength(200)
  reference?: string;

  @ApiPropertyOptional({ example: 45.00, description: 'Receiver-side bank/Payoneer fee in payment currency' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  bankFee?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}

export class WriteOffDto {
  @ApiProperty({ example: 25.50, description: 'Amount to write off in invoice currency' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiProperty({ example: 'Bank conversion shortfall accepted' })
  @IsString() @MinLength(5) @MaxLength(500)
  reason: string;
}

export class SendInvoiceEmailDto {
  @ApiProperty({ example: 'finance@client.com' })
  @IsEmail()
  to: string;

  @ApiPropertyOptional({ example: 'cc@client.com' })
  @IsOptional() @IsEmail()
  cc?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ description: 'Plain-text body (supports {{variables}}); converted to HTML on send' })
  @IsOptional() @IsString() @MaxLength(10000)
  body?: string;

  @ApiPropertyOptional({ description: 'Saved template to use when subject/body are not overridden' })
  @IsOptional() @IsString()
  templateId?: string;

  @ApiPropertyOptional({
    example: 'https://payoneer.com/pay/abc123',
    description: 'Payoneer payment link (different per payment). Renders a "Pay via Payoneer" button in the email. Falls back to the invoice\'s stored payoneerLink.',
  })
  @IsOptional() @IsString() @MaxLength(1000)
  payoneerLink?: string;
}

export class AssignAccountManagerDto {
  @ApiPropertyOptional({ description: 'User id of the account manager. Pass null to clear.' })
  @IsOptional() @IsString()
  accountManagerId?: string | null;
}

export class UpdateInvoiceEmailTemplateDto {
  @ApiPropertyOptional({ description: 'Email subject (supports {{variables}}). Empty = revert to default.' })
  @IsOptional() @IsString() @MaxLength(300)
  subject?: string;

  @ApiPropertyOptional({ description: 'Email body HTML (supports {{variables}}). Empty = revert to default.' })
  @IsOptional() @IsString() @MaxLength(20000)
  body?: string;

  @ApiPropertyOptional({ description: 'Free-text block printed under "Payment Instructions" on the invoice PDF. Empty = revert to default.' })
  @IsOptional() @IsString() @MaxLength(2000)
  paymentInstructions?: string;
}
