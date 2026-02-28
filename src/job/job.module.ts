import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { ActivityLogService } from '../common/services/activity-log.service';
import { RedisService } from '../common/services/redis.service';
import {
  Job,
  JobSchema,
  ActivityLogEvent,
  ActivityLogEventSchema,
} from '../database/schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Job.name, schema: JobSchema },
      { name: ActivityLogEvent.name, schema: ActivityLogEventSchema },
    ]),
  ],
  controllers: [JobController],
  providers: [JobService, ActivityLogService, RedisService],
  exports: [JobService],
})
export class JobModule {}
