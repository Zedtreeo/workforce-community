// apps/api/src/modules/invoices/services/invoice-queue.service.ts
//
// BullMQ wiring: daily cron at 02:00 UTC that calls
// InvoiceAutoGenService.ensureAllDraftsForCurrentMonth().
//
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { InvoiceAutoGenService } from './invoice-auto-gen.service';

export const INVOICES_QUEUE = 'invoices';
export const JOB_DAILY_AUTOGEN = 'daily-autogen';

@Injectable()
export class InvoiceQueueProducer implements OnModuleInit {
  private readonly logger = new Logger(InvoiceQueueProducer.name);
  constructor(@InjectQueue(INVOICES_QUEUE) private readonly q: Queue) {}

  async onModuleInit() {
    // Auto-gen DISABLED — invoices are generated manually, one per employee, via
    // generate-for-assignment (LEGELP/ZT numbering, advance, assignment-dated).
    // The old per-client cron created wrong drafts, so remove any repeatable job
    // already persisted in Redis from a previous deploy.
    try {
      const repeatables = await this.q.getRepeatableJobs();
      for (const r of repeatables) await this.q.removeRepeatableByKey(r.key);
      this.logger.log(`Invoice auto-gen DISABLED — cleared ${repeatables.length} repeatable job(s).`);
    } catch (e) {
      this.logger.warn(`Could not clear invoice repeatable jobs: ${(e as Error).message}`);
    }
  }
}

@Processor(INVOICES_QUEUE)
export class InvoiceQueueWorker extends WorkerHost {
  private readonly logger = new Logger(InvoiceQueueWorker.name);
  constructor(private readonly autoGen: InvoiceAutoGenService) { super(); }

  async process(job: Job) {
    // Auto-gen disabled — no-op any leftover queued jobs instead of generating
    // per-client drafts. (Kept the worker so old jobs drain cleanly.)
    this.logger.log(`Skipping ${job.name} — invoice auto-gen is disabled`);
    return { skipped: true };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`[${job.name}] done: ${JSON.stringify(job.returnvalue)}`);
  }
  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`[${job.name}] failed: ${err.message}`);
  }
}
