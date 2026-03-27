import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityLogService } from './services/activity-log.service';
import { EmailService } from './services/email.service';
import { RedisService } from './services/redis.service';
import { CustomLoggerService } from './services/custom-logger.service';
import { CloudinaryService } from './services/cloudinary.service';
import { AuthGuard } from './guards/auth.guard';
import { QueueModule } from './modules/queue.module';
import { DatabaseModule } from '../database/database.module';
import {
  ActivityLogEvent,
  ActivityLogEventSchema,
  AuthUser,
  AuthUserSchema,
  EmailHistory,
  EmailHistorySchema,
} from '../database/schemas';

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([
      { name: ActivityLogEvent.name, schema: ActivityLogEventSchema },
      { name: AuthUser.name, schema: AuthUserSchema },
      { name: EmailHistory.name, schema: EmailHistorySchema },
    ]),
    QueueModule,
  ],
  providers: [
    ActivityLogService,
    EmailService,
    RedisService,
    CustomLoggerService,
    CloudinaryService,
    AuthGuard,
  ],
  exports: [
    ActivityLogService,
    EmailService,
    RedisService,
    CustomLoggerService,
    CloudinaryService,
    AuthGuard,
    MongooseModule,
    QueueModule,
  ],
})
export class CommonModule {}
