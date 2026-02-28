import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import {
  AuthUser,
  AuthUserSchema,
  UserProfile,
  UserProfileSchema,
  ActivityLogEvent,
  ActivityLogEventSchema,
} from '../database/schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuthUser.name, schema: AuthUserSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: ActivityLogEvent.name, schema: ActivityLogEventSchema },
    ]),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
