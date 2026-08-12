import { IsString, IsBoolean, IsOptional, IsInt, MaxLength, Min, Max, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShiftDto {
  @ApiProperty({ example: 'Morning Shift' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'MORNING' })
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiProperty({ example: '09:00', description: 'Start time in HH:mm format' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Start time must be in HH:mm format' })
  startTime: string;

  @ApiProperty({ example: '18:00', description: 'End time in HH:mm format' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'End time must be in HH:mm format' })
  endTime: string;

  @ApiPropertyOptional({ example: 15, description: 'Grace period in minutes' })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(120)
  graceMinutes?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
