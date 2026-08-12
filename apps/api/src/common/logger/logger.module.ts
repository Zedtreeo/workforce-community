import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger.service';

/**
 * Global logger module — import once in AppModule and LoggerService
 * is available everywhere via DI without re-importing.
 */
@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
