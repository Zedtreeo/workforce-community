import { Module } from '@nestjs/common';
import { ProfileChangesController } from './profile-changes.controller';
import { ProfileChangesService } from './profile-changes.service';

@Module({
  controllers: [ProfileChangesController],
  providers: [ProfileChangesService],
  exports: [ProfileChangesService],
})
export class ProfileChangesModule {}

