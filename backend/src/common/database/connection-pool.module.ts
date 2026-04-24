import { Module } from '@nestjs/common';
import { ConnectionPoolService } from './connection-pool.config';

@Module({
  providers: [ConnectionPoolService],
  exports: [ConnectionPoolService],
})
export class ConnectionPoolModule {}
