import { IsEmail, IsString, Length, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ example: 'client@acme.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'client@acme.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  otp: string;
}

export class SetPortalAccessDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;
}
