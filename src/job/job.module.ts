import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { ActivityLogService } from '../common/services/activity-log.service';
import { RedisService } from '../common/services/redis.service';
import { CustomLoggerService } from '../common/services/custom-logger.service';
import {
  Job,
  JobSchema,
  ActivityLogEvent,
  ActivityLogEventSchema,
} from '../database/schemas';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    CommonModule,
    DatabaseModule,
    MongooseModule.forFeature([
      { name: Job.name, schema: JobSchema },
      { name: ActivityLogEvent.name, schema: ActivityLogEventSchema },
    ]),
  ],
  controllers: [JobController],
  providers: [
    JobService,
    ActivityLogService,
    RedisService,
    CustomLoggerService,
  ],
  exports: [JobService],
})
export class JobModule {}
