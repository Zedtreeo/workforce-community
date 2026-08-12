import {
  IsString, IsOptional, IsEnum, IsDateString,
  MinLength, MaxLength, IsEmail, IsBoolean, Matches, ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeStatus, EngagementType, TaxRegime } from '@prisma/client';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'EMP001' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  employeeCode: string;

  @ApiProperty({ example: 'Rahul' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Sharma' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'rahul.sharma@company.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ example: '+91-9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'Senior Developer' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  designation?: string;

  @ApiPropertyOptional({ example: 'clxyz123...' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  departmentId?: string;

  @ApiPropertyOptional({ example: 'clxyz123...', description: 'Employee id this person reports to (null to clear)' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(100)
  reportingManagerId?: string | null;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  joinDate: string;

  @ApiPropertyOptional({ enum: EmployeeStatus, default: EmployeeStatus.ACTIVE })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional({ enum: EngagementType, default: EngagementType.EMPLOYEE })
  @IsOptional()
  @IsEnum(EngagementType)
  engagementType?: EngagementType;

  @ApiPropertyOptional({ example: '2', description: 'Flat TDS % for consultants (Sec 194J/194C)' })
  @IsOptional()
  @IsString()
  consultantTdsRate?: string;

  @ApiPropertyOptional({ enum: TaxRegime, default: TaxRegime.NEW })
  @IsOptional()
  @IsEnum(TaxRegime)
  taxRegime?: TaxRegime;

  @ApiProperty({ example: '75000.00' })
  @IsString()
  @MaxLength(20)
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'Salary must be a valid decimal number (e.g., 75000.00)' })
  salary: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^[A-Z]{5}\d{4}[A-Z]$/, { message: 'PAN must be in format ABCDE1234F' })
  panNumber?: string;

  @ApiPropertyOptional({ example: 'MH/BAN/12345/000/0001234' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  pfNumber?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(17)
  esiNumber?: string;

  @ApiPropertyOptional({ example: '12345678901234' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\d+$/, { message: 'Bank account must contain only digits' })
  bankAccount?: string;

  @ApiPropertyOptional({ example: 'SBIN0001234' })
  @IsOptional()
  @IsString()
  @MaxLength(11)
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'IFSC must be in format ABCD0123456' })
  bankIfsc?: string;

  @ApiPropertyOptional({ example: true, description: 'Auto-create portal login and send invite email' })
  @IsOptional()
  @IsBoolean()
  grantPortalAccess?: boolean;
}
