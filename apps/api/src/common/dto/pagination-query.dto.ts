import { IsOptional, IsNumberString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Reusable pagination query DTO.
 * Extend or compose into module-specific query DTOs.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ description: 'Items per page (max 100)', example: '20' })
  @IsOptional()
  @IsNumberString()
  limit?: string;
}
