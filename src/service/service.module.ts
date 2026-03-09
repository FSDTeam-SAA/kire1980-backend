import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceService } from './service.service';
import { ServiceController } from './service.controller';
import { Service, ServiceSchema } from '../database/schemas/service.schema';
import {
  BusinessInfo,
  BusinessInfoSchema,
} from '../database/schemas/business-info.schema';
import { AuthUser, AuthUserSchema } from '../database/schemas/auth-user.schema';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Service.name, schema: ServiceSchema },
      { name: BusinessInfo.name, schema: BusinessInfoSchema },
      { name: AuthUser.name, schema: AuthUserSchema },
    ]),
    CommonModule,
  ],
  controllers: [ServiceController],
  providers: [ServiceService],
  exports: [ServiceService],
})
export class ServiceModule {}
