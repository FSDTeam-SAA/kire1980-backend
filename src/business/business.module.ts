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
} from '../database/schemas';
import { CustomLoggerService } from '../common/services/custom-logger.service';

@Module({
  imports: [
    CommonModule,
    DatabaseModule,
    MongooseModule.forFeature([
      { name: BusinessInfo.name, schema: BusinessInfoSchema },
      { name: AuthUser.name, schema: AuthUserSchema },
    ]),
  ],
  controllers: [BusinessController],
  providers: [BusinessService, CustomLoggerService],
  exports: [BusinessService],
})
export class BusinessModule {}
