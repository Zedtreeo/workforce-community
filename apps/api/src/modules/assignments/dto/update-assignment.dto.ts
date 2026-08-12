import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateAssignmentDto } from './create-assignment.dto';

// employeeId + clientId are immutable on update
export class UpdateAssignmentDto extends PartialType(
  OmitType(CreateAssignmentDto, ['employeeId', 'clientId'] as const),
) {}
