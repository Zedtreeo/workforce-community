import {
  IsString, IsOptional, IsDateString, IsIn, IsArray, ValidateNested, IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InitiateExitDto {
  @IsString()
  employeeId!: string;

  @IsDateString()
  lastWorkingDay!: string;

  @IsOptional()
  @IsDateString()
  resignationDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsIn(['RESIGNATION', 'TERMINATION'])
  exitType?: string;
}

export class AdjustmentDto {
  @IsString()
  label!: string;

  @IsNumber()
  amount!: number;
}

export class SettleExitDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdjustmentDto)
  adjustments?: AdjustmentDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
