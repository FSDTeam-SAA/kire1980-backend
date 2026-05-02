import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import {
  Booking,
  BookingSchema,
  BusinessInfo,
  BusinessInfoSchema,
  ReviewRating,
  ReviewRatingSchema,
  AuthUser,
  AuthUserSchema,
} from '../database/schemas';
import { LoggerModule } from '../common/modules/logger.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: BusinessInfo.name, schema: BusinessInfoSchema },
      { name: ReviewRating.name, schema: ReviewRatingSchema },
      { name: AuthUser.name, schema: AuthUserSchema },
    ]),
    LoggerModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
