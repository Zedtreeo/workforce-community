import { PartialType } from '@nestjs/swagger';
import { CreateHelpContentDto } from './create-help-content.dto';

export class UpdateHelpContentDto extends PartialType(CreateHelpContentDto) {}
