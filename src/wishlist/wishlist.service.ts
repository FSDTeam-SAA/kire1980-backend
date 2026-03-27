import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BusinessInfo } from '../database/schemas/business-info.schema';
import { Wishlist } from '../database/schemas/wishlist.schema';
import { CustomLoggerService } from '../common/services/custom-logger.service';

@Injectable()
export class WishlistService {
  constructor(
    @InjectModel(Wishlist.name)
    private readonly wishlistModel: Model<Wishlist>,
    @InjectModel(BusinessInfo.name)
    private readonly businessModel: Model<BusinessInfo>,
    private readonly customLogger: CustomLoggerService,
  ) {}

  async saveBusiness(userId: string, businessId: string) {
    if (!Types.ObjectId.isValid(businessId)) {
      throw new BadRequestException('Invalid business ID');
    }

    const business = await this.businessModel.findOne({
      _id: businessId,
      deletedAt: null,
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const existing = await this.wishlistModel.findOne({
      userId: new Types.ObjectId(userId),
      businessId: new Types.ObjectId(businessId),
    });

    if (existing && !existing.isDeleted) {
      throw new ConflictException('Business is already saved in your wishlist');
    }

    if (existing?.isDeleted) {
      existing.isDeleted = false;
      existing.deletedAt = null;
      await existing.save();

      this.customLogger.log(
        `Wishlist restored for user ${userId} and business ${businessId}`,
        WishlistService.name,
      );

      return existing;
    }

    const wishlist = await this.wishlistModel.create({
      userId: new Types.ObjectId(userId),
      businessId: new Types.ObjectId(businessId),
    });

    this.customLogger.log(
      `Business ${businessId} saved to wishlist by user ${userId}`,
      WishlistService.name,
    );

    return wishlist;
  }

  async getMyWishlist(userId: string) {
    return this.wishlistModel
      .find({ userId: new Types.ObjectId(userId), isDeleted: false })
      .populate('businessId')
      .sort({ createdAt: -1 })
      .lean();
  }

  async removeBusiness(userId: string, businessId: string) {
    if (!Types.ObjectId.isValid(businessId)) {
      throw new BadRequestException('Invalid business ID');
    }

    const wishlist = await this.wishlistModel.findOne({
      userId: new Types.ObjectId(userId),
      businessId: new Types.ObjectId(businessId),
      isDeleted: false,
    });

    if (!wishlist) {
      throw new NotFoundException('Business not found in wishlist');
    }

    wishlist.isDeleted = true;
    wishlist.deletedAt = new Date();
    await wishlist.save();

    this.customLogger.log(
      `Business ${businessId} removed from wishlist by user ${userId}`,
      WishlistService.name,
    );

    return { message: 'Business removed from wishlist successfully' };
  }

  async isBusinessSaved(userId: string, businessId: string) {
    if (!Types.ObjectId.isValid(businessId)) {
      throw new BadRequestException('Invalid business ID');
    }

    const exists = await this.wishlistModel.exists({
      userId: new Types.ObjectId(userId),
      businessId: new Types.ObjectId(businessId),
      isDeleted: false,
    });

    return { saved: !!exists };
  }
}
