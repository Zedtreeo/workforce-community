import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { EmployeesModule } from '../employees/employees.module';
import { ExitController } from './exit.controller';
import { ExitService } from './exit.service';

@Module({
  imports: [PrismaModule, EmployeesModule],
  controllers: [ExitController],
  providers: [ExitService],
  exports: [ExitService],
})
export class ExitModule {}
