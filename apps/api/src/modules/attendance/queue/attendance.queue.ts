// apps/api/src/modules/attendance/queue/attendance.queue.ts
//
// BullMQ wiring — nightly consolidation at 02:00 UTC + on-demand jobs.
// Requires Redis. The connection is configured globally via BullModule.forRoot
// in app.module.ts (or via the env vars REDIS_HOST / REDIS_PORT).
//
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { AttendanceConsolidatorService } from '../attendance-consolidator.service';

export const ATTENDANCE_QUEUE = 'attendance';
export const JOB_CONSOLIDATE = 'consolidate';
export const JOB_CONSOLIDATE_ON_DEMAND = 'consolidate-on-demand';

interface ConsolidateJobData {
  tenantId?: string;
  employeeId?: string;
  fromISO: string;
  toISO: string;
}

@Injectable()
export class AttendanceQueueProducer implements OnModuleInit {
  private readonly logger = new Logger(AttendanceQueueProducer.name);

  constructor(@InjectQueue(ATTENDANCE_QUEUE) private readonly q: Queue) {}

  async onModuleInit() {
    // Idempotent repeatable job — nightly 02:00 UTC for "yesterday"
    await this.q.add(
      JOB_CONSOLIDATE,
      {
        fromISO: this.yesterdayISO(),
        toISO: this.yesterdayISO(),
      } as ConsolidateJobData,
      {
        repeat: { pattern: '0 2 * * *', tz: 'UTC' },
        jobId: 'nightly-consolidate',
        removeOnComplete: 50,
        removeOnFail: 200,
      },
    );
    this.logger.log('Nightly consolidator scheduled (02:00 UTC)');
  }

  async enqueueOnDemand(data: ConsolidateJobData) {
    return this.q.add(JOB_CONSOLIDATE_ON_DEMAND, data, {
      removeOnComplete: 20,
      removeOnFail: 100,
    });
  }

  private yesterdayISO(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }
}

@Processor(ATTENDANCE_QUEUE)
export class AttendanceQueueWorker extends WorkerHost {
  private readonly logger = new Logger(AttendanceQueueWorker.name);

  constructor(private readonly consolidator: AttendanceConsolidatorService) {
    super();
  }

  async process(job: Job<ConsolidateJobData>) {
    const { tenantId, employeeId, fromISO, toISO } = job.data;
    return this.consolidator.consolidate({
      tenantId,
      employeeId,
      from: new Date(fromISO),
      to: new Date(toISO),
    });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`[${job.name}] ${job.id} done: ${JSON.stringify(job.returnvalue)}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`[${job.name}] ${job.id} failed: ${err.message}`);
  }
}
