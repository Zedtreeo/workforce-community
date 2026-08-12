import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Global in-memory cache module.
 * Import once in AppModule — available everywhere without per-module imports.
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
