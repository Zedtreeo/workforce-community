import { IsString, IsBoolean, IsInt, IsOptional, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeaveTypeDto {
  @ApiProperty({ example: 'Casual Leave' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'CL' })
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  @ApiPropertyOptional({ example: 12 })
  @IsInt()
  @Min(0)
  @Max(365)
  @IsOptional()
  defaultDays?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  carryForward?: boolean;

  @ApiPropertyOptional({ example: 5 })
  @IsInt()
  @Min(0)
  @Max(365)
  @IsOptional()
  maxCarryDays?: number;
}
