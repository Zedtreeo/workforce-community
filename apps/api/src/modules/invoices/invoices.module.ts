// REPLACEMENT for apps/api/src/modules/invoices/invoices.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicePaymentService } from './services/invoice-payment.service';
import { InvoiceLineItemsService } from './services/invoice-line-items.service';
import { InvoiceMailerService } from './services/invoice-mailer.service';
import { InvoiceAutoGenService } from './services/invoice-auto-gen.service';
import { InvoiceAccessHelper } from './services/invoice-access.helper';
import {
  InvoiceQueueProducer,
  InvoiceQueueWorker,
  INVOICES_QUEUE,
} from './services/invoice-queue.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    AuditModule,
    BullModule.registerQueue({
      name: INVOICES_QUEUE,
      connection: {
        host: process.env.REDIS_HOST || 'hrms-redis',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
  ],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoicePdfService,
    InvoicePaymentService,
    InvoiceLineItemsService,
    InvoiceMailerService,
    InvoiceAutoGenService,
    InvoiceAccessHelper,
    InvoiceQueueProducer,
    InvoiceQueueWorker,
  ],
  exports: [InvoicesService, InvoiceAutoGenService, InvoiceMailerService],
})
export class InvoicesModule {}
