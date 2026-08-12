import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHelpContentDto {
  @ApiProperty({ example: 'employee.salary', description: 'Unique key like module.fieldName' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  key: string;

  @ApiProperty({ example: 'employees' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  module: string;

  @ApiProperty({ example: 'salary' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fieldName: string;

  @ApiProperty({ example: 'Monthly Salary (CTC)' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'The gross monthly salary for this employee in the tenant currency.' })
  @IsString()
  @MinLength(1)
  description: string;

  @ApiPropertyOptional({ example: '₹45,000' })
  @IsOptional()
  @IsString()
  example?: string;

  @ApiPropertyOptional({ example: 'Must be a positive number. Enter as digits without commas.' })
  @IsOptional()
  @IsString()
  validationRule?: string;

  @ApiPropertyOptional({ example: '/knowledge-base/salary-structure-explained' })
  @IsOptional()
  @IsString()
  learnMoreUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
