import { IsString, IsEmail, IsIn, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteUserDto {
  @ApiProperty({ example: 'user@company.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'] })
  @IsString()
  @IsIn(['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'])
  role: string;

  @ApiProperty({ description: 'Temporary password (min 8 chars, must include uppercase, lowercase, digit, special char)' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;':",.<>?/`~])/, {
    message: 'Password must contain uppercase, lowercase, digit, and special character',
  })
  password: string;
}
