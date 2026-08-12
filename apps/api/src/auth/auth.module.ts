import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { MeController } from '../modules/auth/me.controller';

@Module({
  controllers: [AuthController, MeController],
})
export class AuthModule {}
