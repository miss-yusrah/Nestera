import { Module } from '@nestjs/common';
import { SweepTasksService } from './sweep-tasks.service';
import { UserModule } from '../user/user.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [UserModule, BlockchainModule],
  providers: [SweepTasksService],
})
export class SweepModule {}
