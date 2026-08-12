import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { EmployeeCodeService } from './employee-code.service';
import { PrismaModule } from '../../prisma';
import { EmailModule } from '../email/email.module';
import { LettersModule } from '../letters/letters.module';

@Module({
  imports: [PrismaModule, EmailModule, LettersModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, EmployeeCodeService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
