import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { MongooseService } from './mongoose.service';
import {
  AuthUser,
  AuthUserSchema,
  BusinessInfo,
  BusinessInfoSchema,
  AuthSecurity,
  AuthSecuritySchema,
  UserProfile,
  UserProfileSchema,
  LoginHistory,
  LoginHistorySchema,
  EmailHistory,
  EmailHistorySchema,
  ActivityLogEvent,
  ActivityLogEventSchema,
  Job,
  JobSchema,
  SubscriptionPlan,
  SubscriptionPlanSchema,
  Subscription,
  SubscriptionSchema,
  Payment,
  PaymentSchema,
  Invoice,
  InvoiceSchema,
} from './schemas';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const mongoUri = configService.get<string>('DATABASE_URL');
        return {
          uri: mongoUri,
          maxPoolSize: 10,
          minPoolSize: 5,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        };
      },
    }),
    MongooseModule.forFeature([
      { name: AuthUser.name, schema: AuthUserSchema },
      { name: BusinessInfo.name, schema: BusinessInfoSchema },
      { name: AuthSecurity.name, schema: AuthSecuritySchema },
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: LoginHistory.name, schema: LoginHistorySchema },
      { name: EmailHistory.name, schema: EmailHistorySchema },
      { name: ActivityLogEvent.name, schema: ActivityLogEventSchema },
      { name: Job.name, schema: JobSchema },
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
  ],
  providers: [MongooseService],
  exports: [MongooseModule, MongooseService],
})
export class DatabaseModule {}
