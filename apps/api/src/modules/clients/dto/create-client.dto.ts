import { IsString, IsOptional, IsEmail, IsBoolean, MinLength, MaxLength, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'James', description: 'Primary contact first name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Jordan', description: 'Primary contact last name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({ example: 'finance@acme.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'US', description: 'ISO 3166-1 alpha-2 country code' })
  @IsString()
  @Length(2, 2)
  country: string;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 'billing@acme.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  billingEmail?: string;

  @ApiPropertyOptional({ example: 'payments@acme.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  payoneerEmail?: string;

  @ApiPropertyOptional({ example: 'www.acme.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @ApiPropertyOptional({ example: 'P.O. Box 123, Houston, TX 77001' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  registeredAddress?: string;

  @ApiPropertyOptional({ example: 'James Jordan' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  signatoryName?: string;

  @ApiPropertyOptional({ example: '713-731-7992' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactNumber?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Billing entity (issuing company) that invoices this client; null = tenant default' })
  @IsOptional()
  @IsString()
  billingEntityId?: string | null;
}
