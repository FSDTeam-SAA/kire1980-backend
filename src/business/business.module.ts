import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { CommonModule } from '../common/common.module';
import { DatabaseModule } from '../database/database.module';
import {
  AuthUser,
  AuthUserSchema,
  BusinessInfo,
  BusinessInfoSchema,
  Service,
  ServiceSchema,
  StaffMember,
  StaffMemberSchema,
  ReviewRating,
  ReviewRatingSchema,
  Booking,
  BookingSchema,
} from '../database/schemas';
import { CustomLoggerService } from '../common/services/custom-logger.service';

@Module({
  imports: [
    CommonModule,
    DatabaseModule,
    MongooseModule.forFeature([
      { name: BusinessInfo.name, schema: BusinessInfoSchema },
      { name: AuthUser.name, schema: AuthUserSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: StaffMember.name, schema: StaffMemberSchema },
      { name: ReviewRating.name, schema: ReviewRatingSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
  ],
  controllers: [BusinessController],
  providers: [BusinessService, CustomLoggerService],
  exports: [BusinessService],
})
export class BusinessModule {}
