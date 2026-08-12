import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Identity Proof' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'ID_PROOF' })
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;
}
