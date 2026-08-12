import { IsString, IsBoolean, IsOptional, IsIn, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'] })
  @IsString()
  @IsIn(['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'])
  @IsOptional()
  role?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
