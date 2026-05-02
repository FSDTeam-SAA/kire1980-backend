import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ReviewRating,
  BusinessInfo,
  Service,
  AuthUser,
} from '../database/schemas';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { CustomLoggerService } from '../common/services/custom-logger.service';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(ReviewRating.name)
    private readonly reviewModel: Model<ReviewRating>,
    @InjectModel(BusinessInfo.name)
    private readonly businessModel: Model<BusinessInfo>,
    @InjectModel(Service.name)
    private readonly serviceModel: Model<Service>,
    @InjectModel(AuthUser.name)
    private readonly authUserModel: Model<AuthUser>,
    private readonly customLogger: CustomLoggerService,
  ) {}

  async create(userId: string, createReviewDto: CreateReviewDto) {
    // Verify user exists
    const user = await this.authUserModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify business exists
    const business = await this.businessModel.findById(
      createReviewDto.businessId,
    );
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // Verify service exists and belongs to the business
    const service = await this.serviceModel.findById(createReviewDto.serviceId);
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (service.businessId.toString() !== createReviewDto.businessId) {
      throw new BadRequestException(
        'Service does not belong to the specified business',
      );
    }

    // Check if user already reviewed this service
    const existingReview = await this.reviewModel.findOne({
      userId: new Types.ObjectId(userId),
      serviceId: new Types.ObjectId(createReviewDto.serviceId),
      isDeleted: false,
    });

    if (existingReview) {
      throw new ConflictException(
        'You have already reviewed this service. Please update your existing review instead.',
      );
    }

    // Create the review
    const review = await this.reviewModel.create({
      userId: new Types.ObjectId(userId),
      businessId: new Types.ObjectId(createReviewDto.businessId),
      serviceId: new Types.ObjectId(createReviewDto.serviceId),
      rating: createReviewDto.rating,
      review: createReviewDto.review,
    });

    this.customLogger.log(
      `Review created by user ${userId} for service ${createReviewDto.serviceId}`,
      ReviewService.name,
    );

    return review;
  }

  async findAll(page = 1, limit = 10, businessId?: string, serviceId?: string) {
    const filter: any = { isDeleted: false };

    if (businessId) {
      filter.businessId = new Types.ObjectId(businessId);
    }

    if (serviceId) {
      filter.serviceId = new Types.ObjectId(serviceId);
    }

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .populate('userId', 'email firstName lastName')
        .populate('businessId', 'businessName')
        .populate('serviceId', 'serviceName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.reviewModel.countDocuments(filter),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID');
    }

    const review = await this.reviewModel
      .findOne({ _id: id, isDeleted: false })
      .populate('userId', 'email firstName lastName')
      .populate('businessId', 'businessName')
      .populate('serviceId', 'serviceName')
      .lean();

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  async findByUser(userId: string, page = 1, limit = 10) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.reviewModel
        .find({ userId: new Types.ObjectId(userId), isDeleted: false })
        .populate('businessId', 'businessName')
        .populate('serviceId', 'serviceName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.reviewModel.countDocuments({
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      }),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getServiceRatingStats(serviceId: string) {
    if (!Types.ObjectId.isValid(serviceId)) {
      throw new BadRequestException('Invalid service ID');
    }

    const stats = await this.reviewModel.aggregate([
      {
        $match: {
          serviceId: new Types.ObjectId(serviceId),
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating',
          },
        },
      },
      {
        $project: {
          _id: 0,
          averageRating: { $round: ['$averageRating', 2] },
          totalReviews: 1,
          ratingDistribution: {
            5: {
              $size: {
                $filter: {
                  input: '$ratingDistribution',
                  cond: { $eq: ['$$this', 5] },
                },
              },
            },
            4: {
              $size: {
                $filter: {
                  input: '$ratingDistribution',
                  cond: { $eq: ['$$this', 4] },
                },
              },
            },
            3: {
              $size: {
                $filter: {
                  input: '$ratingDistribution',
                  cond: { $eq: ['$$this', 3] },
                },
              },
            },
            2: {
              $size: {
                $filter: {
                  input: '$ratingDistribution',
                  cond: { $eq: ['$$this', 2] },
                },
              },
            },
            1: {
              $size: {
                $filter: {
                  input: '$ratingDistribution',
                  cond: { $eq: ['$$this', 1] },
                },
              },
            },
          },
        },
      },
    ]);

    return stats.length > 0
      ? stats[0]
      : {
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        };
  }

  async update(id: string, userId: string, updateReviewDto: UpdateReviewDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID');
    }

    const review = await this.reviewModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Check if user owns the review
    if (review.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to update this review',
      );
    }

    // Update the review
    Object.assign(review, updateReviewDto);
    await review.save();

    this.customLogger.log(
      `Review ${id} updated by user ${userId}`,
      ReviewService.name,
    );

    return review;
  }

  async remove(id: string, userId: string, userRole?: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID');
    }

    // Only admin can delete reviews
    if (userRole !== 'admin') {
      throw new ForbiddenException(
        'Only admin can delete reviews',
      );
    }

    const review = await this.reviewModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Soft delete using findByIdAndUpdate
    await this.reviewModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true },
    );

    this.customLogger.log(
      `Review ${id} deleted by admin ${userId}`,
      ReviewService.name,
    );

    return { message: 'Review deleted successfully' };
  }
}
