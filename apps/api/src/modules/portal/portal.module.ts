import { Module } from '@nestjs/common';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { LeavesModule } from '../leaves/leaves.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [LeavesModule, NotificationsModule, AttendanceModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
