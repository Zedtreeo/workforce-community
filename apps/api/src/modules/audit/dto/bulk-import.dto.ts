import {
  IsArray, IsNotEmpty, ArrayMaxSize, ValidateNested,
  IsString, IsOptional, IsNumber, IsEmail, MinLength, MaxLength, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkImportRowDto {
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

  @ApiProperty({ example: 'rahul@company.com' })
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

  @ApiPropertyOptional({ example: 'ENG' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  departmentCode?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsString()
  @MaxLength(20)
  joinDate: string;

  @ApiProperty({ example: 75000 })
  @IsNumber()
  @Min(0)
  salary: number;
}

export class BulkImportDto {
  @ApiProperty({
    description: 'Array of employee rows to import',
    type: [BulkImportRowDto],
    maxItems: 500,
  })
  @IsArray()
  @IsNotEmpty()
  @ArrayMaxSize(500, { message: 'Maximum 500 rows per import batch' })
  @ValidateNested({ each: true })
  @Type(() => BulkImportRowDto)
  rows: BulkImportRowDto[];
}
