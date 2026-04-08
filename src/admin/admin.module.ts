import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common/common.module';
import {
  AuthUser,
  AuthUserSchema,
  Booking,
  BookingSchema,
  BusinessInfo,
  BusinessInfoSchema,
  Service,
  ServiceSchema,
  StaffMember,
  StaffMemberSchema,
} from '../database/schemas';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: AuthUser.name, schema: AuthUserSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: BusinessInfo.name, schema: BusinessInfoSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: StaffMember.name, schema: StaffMemberSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
