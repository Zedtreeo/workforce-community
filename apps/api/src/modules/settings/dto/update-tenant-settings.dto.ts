import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTenantSettingsDto {
  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsString()
  @IsOptional()
  @MaxLength(2048)
  logo?: string;

  @ApiPropertyOptional({ example: 'INR' })
  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  timezone?: string;

  @ApiPropertyOptional({ example: '29ABCDE1234F1ZH' })
  @IsString()
  @IsOptional()
  @MaxLength(15)
  @Matches(/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d][A-Z]$/, { message: 'GST number must be in valid GSTIN format' })
  gstNumber?: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  @Matches(/^[A-Z]{5}\d{4}[A-Z]$/, { message: 'PAN must be in format ABCDE1234F' })
  panNumber?: string;

  @ApiPropertyOptional({ example: 'MH/BAN/12345/000/0001234' })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  pfNumber?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsString()
  @IsOptional()
  @MaxLength(17)
  esiNumber?: string;

  @ApiPropertyOptional({ example: 'https://www.example.com' })
  @IsString()
  @IsOptional()
  @MaxLength(2048)
  website?: string;

  @ApiPropertyOptional({ example: '+91 98765 43210' })
  @IsString()
  @IsOptional()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: 'D-15, Jangpura Extension, New Delhi 110014' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  address?: string;
}
