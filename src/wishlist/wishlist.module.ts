import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import {
  BusinessInfo,
  BusinessInfoSchema,
} from '../database/schemas/business-info.schema';
import { Wishlist, WishlistSchema } from '../database/schemas/wishlist.schema';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wishlist.name, schema: WishlistSchema },
      { name: BusinessInfo.name, schema: BusinessInfoSchema },
    ]),
    CommonModule,
  ],
  controllers: [WishlistController],
  providers: [WishlistService],
  exports: [WishlistService],
})
export class WishlistModule {}
