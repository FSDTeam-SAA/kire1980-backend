import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { BusinessModule } from './business/business.module';
import { ServiceModule } from './service/service.module';
import { ReviewModule } from './review/review.module';
import { StaffModule } from './staff/staff.module';
import { BookingModule } from './booking/booking.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { AdminModule } from './admin/admin.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './common/modules/redis.module';
import { RateLimitModule } from './common/modules/rate-limit.module';
import { MetricsModule } from './metrics/metrics.module';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/config/winston.config';
import { LoggerModule } from './common/modules/logger.module';

const isRateLimitEnabled = process.env.NODE_ENV !== 'development';

@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    // Winston logger module (global - can be injected anywhere)
    WinstonModule.forRoot(winstonConfig),
    // Custom logger module (global - can be injected anywhere)
    LoggerModule,
    // Database module (MongoDB with Mongoose)
    DatabaseModule,
    // Redis module (global - can be injected anywhere)
    RedisModule,
    // Rate limiting module (disabled in development mode for now)
    ...(isRateLimitEnabled ? [RateLimitModule] : []),
    // Metrics module (global - Prometheus metrics)
    MetricsModule,
    // BlogModule,
    AuthModule,
    UserModule,
    BusinessModule,
    ServiceModule,
    ReviewModule,
    StaffModule,
    BookingModule,
    WishlistModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
