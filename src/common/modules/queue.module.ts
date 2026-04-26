import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import config from '../config/app.config';
import { EmailService } from '../services/email.service';
import { SmsService } from '../services/sms.service';
import { PrismaService } from '../services/prisma.service';
import { EmailQueueService } from '../queues/email/email.queue';
import { EmailProcessor } from '../queues/email/email.processor';
import { SmsQueueService } from '../queues/sms/sms.queue';
import { SmsProcessor } from '../queues/sms/sms.processor';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
      },
      prefix: `${config.redis_cache_key_prefix}:bull`,
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
    BullModule.registerQueue({
      name: 'sms',
    }),
  ],
  providers: [
    EmailQueueService,
    EmailProcessor,
    EmailService,
    SmsQueueService,
    SmsProcessor,
    SmsService,
    PrismaService,
  ],
  exports: [EmailQueueService, SmsQueueService],
})
export class QueueModule {}
