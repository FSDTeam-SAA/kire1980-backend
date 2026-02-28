import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthUtilsService } from './services/auth-utils.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { ActivityLogService } from '../common/services/activity-log.service';
import { EmailService } from '../common/services/email.service';
import { RedisService } from '../common/services/redis.service';
import { QueueModule } from '../common/modules';
import {
  AuthUser,
  AuthUserSchema,
  AuthSecurity,
  AuthSecuritySchema,
  UserProfile,
  UserProfileSchema,
  LoginHistory,
  LoginHistorySchema,
  EmailHistory,
  EmailHistorySchema,
} from '../database/schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuthUser.name, schema: AuthUserSchema },
      { name: AuthSecurity.name, schema: AuthSecuritySchema },
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: LoginHistory.name, schema: LoginHistorySchema },
      { name: EmailHistory.name, schema: EmailHistorySchema },
    ]),
    QueueModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthUtilsService,
    GoogleOAuthService,
    ActivityLogService,
    EmailService,
    RedisService,
  ],
  exports: [AuthUtilsService, GoogleOAuthService, AuthService],
})
export class AuthModule {}
