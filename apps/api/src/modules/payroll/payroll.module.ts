import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayStructureController } from './pay-structure.controller';
import { PayStructureService } from './pay-structure.service';
import { PayrollWorkflowController } from './payroll-workflow.controller';
import { PayrollWorkflowService } from './payroll-workflow.service';

@Module({
  controllers: [PayrollController, PayStructureController, PayrollWorkflowController],
  providers: [PayrollService, PayStructureService, PayrollWorkflowService],
  exports: [PayrollService, PayStructureService, PayrollWorkflowService],
})
export class PayrollModule {}
