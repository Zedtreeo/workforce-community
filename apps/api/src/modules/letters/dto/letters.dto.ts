// apps/api/src/modules/letters/dto/letters.dto.ts
import {
  IsString, IsOptional, IsEnum, IsBoolean, IsObject, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LetterType, LetterStatus } from '@prisma/client';

export class PreviewLetterDto {
  @ApiProperty({ enum: LetterType })
  @IsEnum(LetterType)
  type: LetterType;

  @ApiProperty()
  @IsString()
  templateId: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  assignmentId?: string;
}

export class GenerateLetterDto extends PreviewLetterDto {
  @ApiPropertyOptional({ description: 'Dotted-path overrides from the Generate dialog' })
  @IsOptional() @IsObject()
  overrides?: Record<string, any>;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  generatePdf?: boolean;
}

export class SendLetterDto {
  @ApiProperty()
  @IsString()
  to: string;          // recipient email

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(2000)
  bodyHtml?: string;

  @ApiPropertyOptional({ enum: ['docx', 'pdf'], default: 'pdf' })
  @IsOptional() @IsString()
  attachAs?: 'docx' | 'pdf';
}

export class MarkStatusDto {
  @ApiProperty({ enum: LetterStatus })
  @IsEnum(LetterStatus)
  status: LetterStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  sentTo?: string;
}
