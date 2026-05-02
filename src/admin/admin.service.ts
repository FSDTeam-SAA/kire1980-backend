import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import {
  AuthUser,
  Booking,
  BusinessInfo,
  Service,
  StaffMember,
} from '../database/schemas';
import { BookingStatus } from '../database/schemas/booking.schema';
import { CustomLoggerService } from '../common/services/custom-logger.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(AuthUser.name)
    private readonly authUserModel: Model<AuthUser>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
    @InjectModel(BusinessInfo.name)
    private readonly businessInfoModel: Model<BusinessInfo>,
    @InjectModel(Service.name)
    private readonly serviceModel: Model<Service>,
    @InjectModel(StaffMember.name)
    private readonly staffMemberModel: Model<StaffMember>,
    private readonly customLogger: CustomLoggerService,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async deleteBusinessByAdmin(
    businessId: string,
  ): Promise<{ businessId: string }> {
    if (!Types.ObjectId.isValid(businessId)) {
      throw new BadRequestException('Invalid business ID');
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const business = await this.businessInfoModel
        .findOne({ _id: businessId, deletedAt: null })
        .session(session);

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      business.deletedAt = new Date();
      await business.save({ session });

      await this.authUserModel.updateOne(
        { _id: business.ownerId },
        {
          $set: {
            businessId: null,
            role: 'customer',
          },
        },
        { session },
      );

      await session.commitTransaction();

      this.customLogger.log(
        `Business soft deleted by admin: ${businessId}`,
        AdminService.name,
      );

      return {
        businessId,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async getDashboardOverview() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const [
      totalCustomers,
      totalBookings,
      todayBookings,
      totalBusinesses,
      totalServices,
    ] = await Promise.all([
      this.authUserModel.countDocuments({
        role: 'customer',
        deletedAt: null,
        status: { $ne: 'DELETED' },
      }),
      this.bookingModel.countDocuments({ isDeleted: false }),
      this.bookingModel.countDocuments({
        isDeleted: false,
        'services.dateAndTime': {
          $gte: startOfToday,
          $lte: endOfToday,
        },
      }),
      this.businessInfoModel.countDocuments({ deletedAt: null }),
      this.serviceModel.countDocuments({ isActive: true }),
    ]);

    return {
      totalCustomers,
      totalBookings,
      todayBookings,
      totalBusinesses,
      totalServices,
    };
  }

  async getBookingTrends(year?: number) {
    const currentYear = new Date().getFullYear();
    const selectedYear =
      typeof year === 'number' && Number.isInteger(year) && year > 0
        ? year
        : currentYear;

    const startOfYear = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(selectedYear + 1, 0, 1, 0, 0, 0, 0);

    const monthlyRaw = await this.bookingModel.aggregate<{
      _id: { month: number };
      totalBookings: number;
    }>([
      {
        $match: {
          isDeleted: false,
          createdAt: { $gte: startOfYear, $lt: endOfYear },
        },
      },
      {
        $group: {
          _id: { month: { $month: '$createdAt' } },
          totalBookings: { $sum: 1 },
        },
      },
      { $sort: { '_id.month': 1 } },
    ]);

    const monthlyCountMap = new Map<number, number>(
      monthlyRaw.map((item) => [item._id.month, item.totalBookings]),
    );

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const monthly = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return {
        month,
        monthName: monthNames[index],
        totalBookings: monthlyCountMap.get(month) ?? 0,
      };
    });

    const startYear = currentYear - 4;
    const yearlyRaw = await this.bookingModel.aggregate<{
      _id: { year: number };
      totalBookings: number;
    }>([
      {
        $match: {
          isDeleted: false,
          createdAt: {
            $gte: new Date(startYear, 0, 1),
            $lt: new Date(currentYear + 1, 0, 1),
          },
        },
      },
      {
        $group: {
          _id: { year: { $year: '$createdAt' } },
          totalBookings: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1 } },
    ]);

    const yearlyCountMap = new Map<number, number>(
      yearlyRaw.map((item) => [item._id.year, item.totalBookings]),
    );

    const yearly = Array.from({ length: 5 }, (_, index) => {
      const targetYear = startYear + index;
      return {
        year: targetYear,
        totalBookings: yearlyCountMap.get(targetYear) ?? 0,
      };
    });

    return {
      selectedYear,
      monthly,
      yearly,
    };
  }

  async getTopBusinessesByPayment(limit = 3) {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 3;

    const topBusinesses = await this.bookingModel.aggregate<{
      businessId: string;
      businessName: string;
      totalPayment: number;
      totalBookings: number;
    }>([
      {
        $match: {
          isDeleted: false,
        },
      },
      {
        $unwind: '$services',
      },
      {
        $lookup: {
          from: 'services',
          localField: 'services.serviceId',
          foreignField: '_id',
          as: 'serviceInfo',
        },
      },
      {
        $unwind: {
          path: '$serviceInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: '$businessId',
          totalPayment: { $sum: { $ifNull: ['$serviceInfo.price', 0] } },
          bookingIds: { $addToSet: '$_id' },
        },
      },
      {
        $lookup: {
          from: 'business_info',
          let: { businessId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$businessId'] },
                deletedAt: null,
              },
            },
            {
              $project: {
                _id: 0,
                businessName: 1,
              },
            },
          ],
          as: 'businessInfo',
        },
      },
      {
        $project: {
          _id: 0,
          businessId: { $toString: '$_id' },
          businessName: {
            $ifNull: [
              { $arrayElemAt: ['$businessInfo.businessName', 0] },
              'N/A',
            ],
          },
          totalPayment: 1,
          totalBookings: { $size: '$bookingIds' },
        },
      },
      {
        $sort: {
          totalPayment: -1,
        },
      },
      {
        $limit: safeLimit,
      },
    ]);

    return {
      limit: safeLimit,
      topBusinesses,
    };
  }

  async deleteUserByAdmin(userId: string): Promise<{ userId: string }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.authUserModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.status = 'DELETED';
    user.deletedAt = new Date();
    await user.save();

    this.customLogger.log(
      `User soft deleted by admin: ${userId}`,
      AdminService.name,
    );

    return {
      userId,
    };
  }
}
