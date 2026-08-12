// apps/api/src/modules/attendance/attendance.module.ts
//
// BullMQ queue is wired in. Connection comes from BullModule.forRoot in
// app.module.ts (env: REDIS_HOST, REDIS_PORT).
//
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceImportService } from './attendance-import.service';
import { AttendanceConsolidatorService } from './attendance-consolidator.service';
import { AutoClockoutService } from './auto-clockout.service';
import {
  AttendanceQueueProducer,
  AttendanceQueueWorker,
  ATTENDANCE_QUEUE,
} from './queue/attendance.queue';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    AuditModule,
    BullModule.registerQueue({
      name: ATTENDANCE_QUEUE,
      connection: {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
  ],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    AttendanceImportService,
    AttendanceConsolidatorService,
    AutoClockoutService,
    AttendanceQueueProducer,
    AttendanceQueueWorker,
  ],
  exports: [AttendanceService, AttendanceConsolidatorService, AutoClockoutService],
})
export class AttendanceModule {}
