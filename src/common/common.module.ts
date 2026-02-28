import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityLogService } from './services/activity-log.service';
import { EmailService } from './services/email.service';
import { RedisService } from './services/redis.service';
import { CustomLoggerService } from './services/custom-logger.service';
import { QueueModule } from './modules/queue.module';
import {
  ActivityLogEvent,
  ActivityLogEventSchema,
  EmailHistory,
  EmailHistorySchema,
} from '../database/schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityLogEvent.name, schema: ActivityLogEventSchema },
      { name: EmailHistory.name, schema: EmailHistorySchema },
    ]),
    QueueModule,
  ],
  providers: [
    ActivityLogService,
    EmailService,
    RedisService,
    CustomLoggerService,
  ],
  exports: [
    ActivityLogService,
    EmailService,
    RedisService,
    CustomLoggerService,
    MongooseModule,
    QueueModule,
  ],
})
export class CommonModule {}
