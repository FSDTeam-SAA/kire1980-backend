import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import {
  StaffMember,
  StaffMemberSchema,
  BusinessInfo,
  BusinessInfoSchema,
  Service,
  ServiceSchema,
  AuthUser,
  AuthUserSchema,
} from '../database/schemas';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StaffMember.name, schema: StaffMemberSchema },
      { name: BusinessInfo.name, schema: BusinessInfoSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: AuthUser.name, schema: AuthUserSchema },
    ]),
    CommonModule,
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
