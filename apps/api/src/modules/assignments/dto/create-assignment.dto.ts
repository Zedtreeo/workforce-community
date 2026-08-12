import { IsString, IsOptional, IsDateString, IsEnum, Length, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, WorkSchedule } from '@prisma/client';

export class CreateAssignmentDto {
  @ApiProperty({ example: 'clxyz123...' })
  @IsString()
  @MaxLength(100)
  employeeId: string;

  @ApiProperty({ example: 'clxyz456...' })
  @IsString()
  @MaxLength(100)
  clientId: string;

  @ApiPropertyOptional({ example: 'Senior Backend Engineer' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  role?: string;

  @ApiProperty({ example: '2026-05-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ example: '3500.00' })
  @IsString()
  @MaxLength(20)
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'Billing rate must be a valid decimal (e.g., 3500.00)' })
  billingRate: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ enum: BillingCycle, default: BillingCycle.MONTHLY })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({ enum: WorkSchedule, default: WorkSchedule.FULL_TIME })
  @IsOptional()
  @IsEnum(WorkSchedule)
  workSchedule?: WorkSchedule;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
