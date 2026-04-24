import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataExportController } from './data-export.controller';
import { DataExportService } from './data-export.service';
import { DataExportRequest } from './entities/data-export-request.entity';
import { User } from '../user/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { SavingsGoal } from '../savings/entities/savings-goal.entity';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DataExportRequest,
      User,
      Transaction,
      Notification,
      SavingsGoal,
    ]),
    MailModule,
  ],
  controllers: [DataExportController],
  providers: [DataExportService],
})
export class DataExportModule {}
