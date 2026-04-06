import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import {
  Booking,
  BookingSchema,
  BusinessInfo,
  BusinessInfoSchema,
  Service,
  ServiceSchema,
  StaffMember,
  StaffMemberSchema,
  AuthUser,
  AuthUserSchema,
} from '../database/schemas';
import { CommonModule } from '../common/common.module';
import { StaffModule } from '../staff/staff.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: BusinessInfo.name, schema: BusinessInfoSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: StaffMember.name, schema: StaffMemberSchema },
      { name: AuthUser.name, schema: AuthUserSchema },
    ]),
    CommonModule,
    StaffModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
