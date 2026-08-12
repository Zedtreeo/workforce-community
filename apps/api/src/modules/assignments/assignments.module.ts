import { Module } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { LettersModule } from '../letters/letters.module';

@Module({
  imports: [LettersModule, InvoicesModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
