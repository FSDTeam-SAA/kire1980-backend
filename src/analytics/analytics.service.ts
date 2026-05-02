import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Booking,
  BusinessInfo,
  ReviewRating,
  AuthUser,
} from '../database/schemas';
import { CustomLoggerService } from '../common/services/custom-logger.service';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
    @InjectModel(BusinessInfo.name)
    private readonly businessModel: Model<BusinessInfo>,
    @InjectModel(ReviewRating.name)
    private readonly reviewModel: Model<ReviewRating>,
    @InjectModel(AuthUser.name)
    private readonly authUserModel: Model<AuthUser>,
    private readonly customLogger: CustomLoggerService,
  ) {}

  async getAnalytics() {
    try {
      // 1. Total completed bookings count
      const totalCompletedBookings = await this.bookingModel.countDocuments({
        isDeleted: false,
        bookingStatus: 'completed',
      });

      // 2. Total verified business count
      const totalVerifiedBusinesses = await this.businessModel.countDocuments({
        deletedAt: null,
        verification: 'verified',
      });

      // 3. Active bookings count (not deleted, not completed, not cancelled)
      const activeBookings = await this.bookingModel.countDocuments({
        isDeleted: false,
        bookingStatus: { $nin: ['completed', 'cancelled', 'rejected'] },
      });

      // 4. Static availability text
      const availability = '24/7';

      // 5. Total review percentage
      // Calculate: (total reviews / total bookings) * 100
      const totalBookings = await this.bookingModel.countDocuments({
        isDeleted: false,
      });
      const totalReviews = await this.reviewModel.countDocuments({
        isDeleted: false,
      });
      const reviewPercentage =
        totalBookings > 0
          ? parseFloat(((totalReviews / totalBookings) * 100).toFixed(2))
          : 0;

      // 6. Booking fill rate percentage
      // Calculate: (users with at least one booking / total users) * 100
      const totalUsers = await this.authUserModel.countDocuments({
        status: { $ne: 'DELETED' },
        deletedAt: null,
      });

      const usersWithBookings = await this.bookingModel.aggregate<{
        uniqueUsers: number;
      }>([
        {
          $match: { isDeleted: false },
        },
        {
          $group: {
            _id: '$userId',
          },
        },
        {
          $count: 'uniqueUsers',
        },
      ]);

      const usersWithBookingsCount =
        usersWithBookings.length > 0 ? usersWithBookings[0].uniqueUsers : 0;
      const bookingFillRate =
        totalUsers > 0
          ? Number.parseFloat(
              ((usersWithBookingsCount / totalUsers) * 100).toFixed(2),
            )
          : 0;

      this.customLogger.log(
        'Analytics data retrieved successfully',
        AnalyticsService.name,
      );

      return {
        totalCompletedBookings,
        totalVerifiedBusinesses,
        activeBookings,
        availability,
        reviewPercentage,
        bookingFillRate,
        totalBookings,
        totalReviews,
        totalUsers,
        usersWithBookings: usersWithBookingsCount,
      };
    } catch (error) {
      const err = error as Error;
      this.customLogger.error(
        `Error retrieving analytics: ${err.message}`,
        err.stack || '',
        AnalyticsService.name,
      );
      throw error;
    }
  }
}
