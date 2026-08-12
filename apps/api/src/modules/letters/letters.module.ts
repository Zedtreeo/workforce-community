// apps/api/src/modules/letters/letters.module.ts
import { Module } from '@nestjs/common';
import { LettersController } from './letters.controller';
import { LetterGenerationService } from './services/letter-generation.service';
import { VariableResolverService } from './services/variable-resolver.service';
import { ReferenceNumberService } from './services/reference-number.service';
import { CarboneAdapter } from './services/carbone.adapter';
import { LetterMailerService } from './services/letter-mailer.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [LettersController],
  providers: [
    LetterGenerationService,
    VariableResolverService,
    ReferenceNumberService,
    CarboneAdapter,
    LetterMailerService,
  ],
  exports: [LetterGenerationService, VariableResolverService],
})
export class LettersModule {}
