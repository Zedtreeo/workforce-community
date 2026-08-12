import { IsString, IsDateString, IsBoolean, IsOptional, IsInt, MaxLength, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHolidayDto {
  @ApiProperty({ example: 'Republic Day' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: '2026-01-26' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isOptional?: boolean;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;
}
