// apps/api/src/modules/invoices/dto/line-items.dto.ts
import { IsString, IsNumber, IsOptional, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddLineItemDto {
  @ApiProperty({ example: 'Project Setup Fee — One-time' })
  @IsString() @MinLength(1) @MaxLength(300)
  description: string;

  @ApiProperty({ example: 1, description: 'Quantity (e.g. 1 for fixed, hours for hourly)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  quantity: number;

  @ApiProperty({ example: 500, description: 'Rate per unit (CAN BE NEGATIVE for deductions/discounts)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  rate: number;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber()
  sortOrder?: number;
}

export class UpdateLineItemDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  quantity?: number;

  @ApiPropertyOptional({ description: 'CAN BE NEGATIVE for deductions' })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  rate?: number;
}
