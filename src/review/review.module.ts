import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import {
  ReviewRating,
  ReviewRatingSchema,
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
      { name: ReviewRating.name, schema: ReviewRatingSchema },
      { name: BusinessInfo.name, schema: BusinessInfoSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: AuthUser.name, schema: AuthUserSchema },
    ]),
    CommonModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
