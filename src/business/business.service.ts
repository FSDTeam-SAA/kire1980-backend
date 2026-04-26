import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import {
  AuthUser,
  Booking,
  BookingStatus,
  BusinessInfo,
  BusinessStatus,
  BusinessVerification,
  Service,
  StaffMember,
  ReviewRating,
} from '../database/schemas';
import { CreateBusinessDto } from './dto/create-business.dto';
import { CustomLoggerService } from '../common/services/custom-logger.service';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { createPaginatedResponse } from '../common/decorators/api-pagination.decorator';
import { BusinessQueryDto } from './dto/business-query.dto';
import { REDIS_CLIENT } from '../common/modules/redis.module';
import { Redis as RedisType } from 'ioredis';

@Injectable()
export class BusinessService {
  constructor(
    @InjectModel(BusinessInfo.name)
    private readonly businessModel: Model<BusinessInfo>,
    @InjectModel(AuthUser.name)
    private readonly authUserModel: Model<AuthUser>,
    @InjectModel(Service.name)
    private readonly serviceModel: Model<Service>,
    @InjectModel(StaffMember.name)
    private readonly staffModel: Model<StaffMember>,
    @InjectModel(ReviewRating.name)
    private readonly reviewModel: Model<ReviewRating>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
    private readonly customLogger: CustomLoggerService,
    private readonly cloudinaryService: CloudinaryService,
    @InjectConnection()
    private readonly connection: Connection,
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisType,
  ) {}

  async getBusinessOwnerStatistics(ownerId: string, role: string) {
    if (role !== 'businessowner' && role !== 'admin') {
      throw new ForbiddenException(
        'Only business owners can access statistics',
      );
    }

    const business = await this.businessModel
      .findOne({ ownerId, deletedAt: null })
      .select('_id')
      .lean();

    if (!business) {
      throw new NotFoundException('Business not found for this user');
    }

    const businessObjectId = new Types.ObjectId(business._id);

    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const [
      todaysBookingsAgg,
      newCustomersAgg,
      monthlyRevenueAgg,
      avgRatingAgg,
    ] = await Promise.all([
      // 1. Today's Bookings (Count of individual active service items today)
      this.bookingModel.aggregate([
        {
          $match: {
            businessId: businessObjectId,
            isDeleted: false,
            bookingStatus: {
              $nin: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
            },
            'services.dateAndTime': { $gte: startOfToday, $lte: endOfToday },
          },
        },
        { $unwind: '$services' },
        {
          $match: {
            'services.dateAndTime': { $gte: startOfToday, $lte: endOfToday },
          },
        },
        { $count: 'total' },
      ]),

      // 2. New Statistics/Customers (Users whose first booking was this month)
      this.bookingModel.aggregate([
        {
          $match: {
            businessId: businessObjectId,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: '$userId',
            firstBookingDate: { $min: '$createdAt' },
          },
        },
        {
          $match: {
            firstBookingDate: { $gte: startOfMonth, $lte: endOfMonth },
          },
        },
        { $count: 'total' },
      ]),

      // 3. Monthly Revenue (Sum of COMPLETED services this month)
      this.bookingModel.aggregate([
        {
          $match: {
            businessId: businessObjectId,
            isDeleted: false,
            bookingStatus: BookingStatus.COMPLETED,
            $or: [
              { completedAt: { $gte: startOfMonth, $lte: endOfMonth } },
              {
                $and: [
                  { completedAt: { $eq: null } },
                  { updatedAt: { $gte: startOfMonth, $lte: endOfMonth } },
                ],
              },
            ],
          },
        },
        { $unwind: '$services' },
        {
          $lookup: {
            from: 'services',
            localField: 'services.serviceId',
            foreignField: '_id',
            as: 'serviceDetail',
          },
        },
        { $unwind: '$serviceDetail' },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$serviceDetail.price' },
          },
        },
      ]),

      // 4. Average Rating
      this.reviewModel.aggregate([
        {
          $match: {
            businessId: businessObjectId,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
          },
        },
      ]),
    ]);

    const todaysBookings = todaysBookingsAgg[0]?.total ?? 0;
    const newCustomer = newCustomersAgg[0]?.total ?? 0;
    const monthlyRevenue = Number(
      (monthlyRevenueAgg[0]?.totalRevenue ?? 0).toFixed(2),
    );
    const averageRating = Number((avgRatingAgg[0]?.avgRating ?? 0).toFixed(1));

    return {
      newCustomer,
      todaysBookings,
      monthlyRevenue,
      averageRating,
    };
  }

  async createBusiness(
    ownerId: string,
    payload: CreateBusinessDto,
    files: Array<Express.Multer.File> = [],
  ) {
    const owner = await this.authUserModel.findById(ownerId);
    if (!owner) {
      throw new NotFoundException('Owner user not found');
    }

    if (owner.businessId) {
      throw new BadRequestException('This user already has a business');
    }

    const existingByOwner = await this.businessModel.findOne({ ownerId });
    if (existingByOwner) {
      throw new BadRequestException('Business already exists for this user');
    }

    const existingEmail = await this.businessModel.findOne({
      businessEmail: payload.businessEmail,
    });
    if (existingEmail) {
      throw new BadRequestException('Business email already exists');
    }

    const uploadedGallery = await Promise.all(
      (files || []).map(async (file) => {
        const uploaded = await this.cloudinaryService.uploadImage(
          file.buffer,
          'business-gallery',
        );
        return {
          url: uploaded.url,
          publicId: uploaded.publicId,
        };
      }),
    );

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const created = await this.businessModel.create(
        [
          {
            businessName: payload.businessName,
            businessEmail: payload.businessEmail,
            phoneNumber: payload.phoneNumber,
            businessCategory: payload.businessCategory,
            totalStaff: payload.totalStaff,
            country: payload.country,
            city: payload.city,
            postalCode: payload.postalCode,
            sector: payload.sector,
            description: payload.description,
            ownerId,
            status: BusinessStatus.PENDING,
            verification: BusinessVerification.PENDING,
            gallery: uploadedGallery,
            openingHours: payload.openingHour,
          },
        ],
        { session },
      );

      const business = created[0];

      await this.authUserModel.findByIdAndUpdate(
        ownerId,
        {
          businessId: business._id,
          role: owner.role === 'admin' ? 'admin' : 'businessowner',
        },
        { session },
      );

      await session.commitTransaction();

      this.customLogger.log(
        `Business created: ${business._id.toString()} by user: ${ownerId}`,
        'BusinessService',
      );

      return business;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async getAllBusinesses(query: BusinessQueryDto, user?: { role: string }) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      city,
      country,
      postalCode,
      zipCode,
    } = query;

    const filter: any = {
      deletedAt: null,
    };

    // Public users (guest or non-admin) only see VERIFIED businesses
    if (user?.role !== 'admin') {
      filter.verification = BusinessVerification.VERIFIED;
    }

    if (search) {
      filter.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { businessEmail: { $regex: search, $options: 'i' } },
        { businessCategory: { $regex: search, $options: 'i' } },
      ];
    }

    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    if (country) {
      filter.country = { $regex: country, $options: 'i' };
    }

    const resolvedPostalCode = postalCode ?? zipCode;
    if (resolvedPostalCode !== undefined) {
      filter.postalCode = resolvedPostalCode;
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.businessModel
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .populate('ownerId', 'fullName email role')
        .lean(),
      this.businessModel.countDocuments(filter),
    ]);

    return createPaginatedResponse(items, total, page, limit);
  }

  async getMyBusiness(ownerId: string) {
    const business = await this.businessModel
      .findOne({ ownerId, deletedAt: null })
      .populate('ownerId', 'fullName email role')
      .lean();

    if (!business) {
      throw new NotFoundException('Business not found for this user');
    }

    return business;
  }

  async getBusinessById(businessId: string): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(businessId)) {
      throw new BadRequestException('Invalid business ID');
    }

    const business = await this.businessModel
      .findOne({ _id: businessId, deletedAt: null })
      .populate('ownerId', 'fullName email role')
      .lean();

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const businessObjectId = new Types.ObjectId(businessId);

    // Fetch services, staff, and reviews in parallel
    const [services, staff, reviews] = await Promise.all([
      this.serviceModel
        .find({ businessId: businessObjectId, isActive: true })
        .select(
          'serviceName category price serviceDuration averageRating serviceImages isFeatured',
        )
        .lean(),

      this.staffModel
        .find({
          businessId: businessObjectId,
          isDeleted: false,
          isActive: true,
        })
        .select(
          'firstName lastName email phoneNumber description avatar schedule serviceIds',
        )
        .populate('serviceIds', 'serviceName category')
        .lean(),

      this.reviewModel
        .find({ businessId: businessObjectId, isDeleted: false })
        .select('rating review userId createdAt')
        .populate('userId', 'fullName')
        .lean(),
    ]);

    // Compute aggregate rating
    const averageRating =
      reviews.length > 0
        ? Number.parseFloat(
            (
              reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            ).toFixed(1),
          )
        : 0;

    return {
      ...business,
      services,
      staff,
      reviews,
      averageRating,
      totalReviews: reviews.length,
      totalServices: services.length,
      totalStaffMembers: staff.length,
    };
  }

  async toggleBusinessStatus(businessId: string, actorRole: string) {
    if (actorRole !== 'admin') {
      throw new ForbiddenException('Only admin can toggle business status');
    }

    const business = await this.businessModel.findById(businessId);
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (business.status === BusinessStatus.ACTIVATED) {
      business.status = BusinessStatus.DEACTIVATED;
    } else {
      business.status = BusinessStatus.ACTIVATED;
      business.verification = BusinessVerification.VERIFIED;
    }

    await business.save();

    this.customLogger.log(
      `Business status toggled to ${business.status}: ${businessId}`,
      'BusinessService',
    );

    return business;
  }

  async getStaffIndividualStats(ownerId: string, staffId: string) {
    const business = await this.businessModel
      .findOne({ ownerId, deletedAt: null })
      .select('_id')
      .lean();

    if (!business) {
      throw new NotFoundException('Business not found for this user');
    }

    const businessObjectId = new Types.ObjectId(business._id);
    const staffObjectId = new Types.ObjectId(staffId);

    // Verify staff belongs to this business
    const staff = await this.staffModel.findOne({
      _id: staffObjectId,
      businessId: businessObjectId,
      isDeleted: false,
    });

    if (!staff) {
      throw new NotFoundException(
        'Staff member not found in your business records',
      );
    }

    const statsAgg = await this.bookingModel.aggregate([
      {
        $match: {
          businessId: businessObjectId,
          isDeleted: false,
          'services.selectedProvider': staffObjectId,
        },
      },
      { $unwind: '$services' },
      {
        $match: {
          'services.selectedProvider': staffObjectId,
        },
      },
      {
        $lookup: {
          from: 'services',
          localField: 'services.serviceId',
          foreignField: '_id',
          as: 'serviceInfo',
        },
      },
      { $unwind: '$serviceInfo' },
      {
        $group: {
          _id: null,
          totalBookings: { $addToSet: '$_id' },
          completedServices: {
            $sum: {
              $cond: [
                { $eq: ['$bookingStatus', BookingStatus.COMPLETED] },
                1,
                0,
              ],
            },
          },
          revenueGenerated: {
            $sum: {
              $cond: [
                { $eq: ['$bookingStatus', BookingStatus.COMPLETED] },
                '$serviceInfo.price',
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalBookings: { $size: '$totalBookings' },
          completedServices: 1,
          revenueGenerated: { $round: ['$revenueGenerated', 2] },
        },
      },
    ]);

    const stats = statsAgg[0] || {
      totalBookings: 0,
      completedServices: 0,
      revenueGenerated: 0,
    };

    return stats;
  }

  async getStaffManagementCount(ownerId: string) {
    const business = await this.businessModel
      .findOne({ ownerId, deletedAt: null })
      .select('_id')
      .lean();

    if (!business) {
      throw new NotFoundException('Business not found for this user');
    }

    const businessObjectId = new Types.ObjectId(business._id);
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const activeBookingStatuses = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
    ];

    const [totalStaff, totalBookedTodayAgg, activeBookingsAgg] =
      await Promise.all([
        // 1. Total Staff
        this.staffModel.countDocuments({
          businessId: businessObjectId,
          isDeleted: false,
        }),
        // 2. Total Booked Today (Number of service items)
        this.bookingModel.aggregate([
          {
            $match: {
              businessId: businessObjectId,
              isDeleted: false,
              'services.dateAndTime': { $gte: startOfToday, $lte: endOfToday },
            },
          },
          { $unwind: '$services' },
          {
            $match: {
              'services.dateAndTime': { $gte: startOfToday, $lte: endOfToday },
            },
          },
          { $count: 'total' },
        ]),
        // 3. Data for Currently On Duty
        this.bookingModel.aggregate([
          {
            $match: {
              businessId: businessObjectId,
              isDeleted: false,
              bookingStatus: { $in: activeBookingStatuses },
              'services.dateAndTime': { $lte: now },
            },
          },
          { $unwind: '$services' },
          {
            $match: {
              'services.dateAndTime': { $lte: now },
            },
          },
          {
            $lookup: {
              from: 'services',
              localField: 'services.serviceId',
              foreignField: '_id',
              as: 'serviceDetail',
            },
          },
          { $unwind: '$serviceDetail' },
          {
            $project: {
              selectedProvider: '$services.selectedProvider',
              startTime: '$services.dateAndTime',
              duration: '$serviceDetail.serviceDuration',
            },
          },
        ]),
      ]);

    const totalBookedToday = totalBookedTodayAgg[0]?.total || 0;

    // Calculate Currently On Duty
    const onDutyStaffIds = new Set<string>();
    for (const item of activeBookingsAgg) {
      const startTime = new Date(item.startTime);
      const durationMinutes = this.parseDurationToMinutes(item.duration);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

      if (startTime <= now && now < endTime) {
        onDutyStaffIds.add(item.selectedProvider.toString());
      }
    }

    return {
      totalStaff,
      currentlyOnDuty: onDutyStaffIds.size,
      totalBookedToday,
    };
  }

  async getServiceManagementCount(ownerId: string) {
    const business = await this.businessModel
      .findOne({ ownerId, deletedAt: null })
      .select('_id')
      .lean();

    if (!business) {
      throw new NotFoundException('Business not found for this user');
    }

    const ownerObjectId = new Types.ObjectId(ownerId);
    const businessObjectId = new Types.ObjectId(business._id);

    const [totalServices, active, topCategoryData, totalBookings] =
      await Promise.all([
        this.serviceModel.countDocuments({
          $or: [
            { businessId: businessObjectId },
            { businessOwnerId: ownerObjectId },
          ],
        }),
        this.serviceModel.countDocuments({
          $or: [
            { businessId: businessObjectId },
            { businessOwnerId: ownerObjectId },
          ],
          isActive: true,
        }),
        this.serviceModel.aggregate([
          {
            $match: {
              $or: [
                { businessId: businessObjectId },
                { businessOwnerId: ownerObjectId },
              ],
            },
          },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 },
        ]),
        this.bookingModel.countDocuments({
          businessId: businessObjectId,
          isDeleted: false,
        }),
      ]);

    const topCategory =
      topCategoryData.length > 0 ? topCategoryData[0]._id : 'N/A';
    const avgBooking =
      totalServices > 0
        ? Number((totalBookings / totalServices).toFixed(2))
        : 0;

    return {
      totalServices,
      active,
      topCategory,
      avgBooking,
    };
  }

  async getBookingManagementCount(ownerId: string) {
    const business = await this.businessModel
      .findOne({ ownerId, deletedAt: null })
      .select('_id')
      .lean();

    if (!business) {
      throw new NotFoundException('Business not found for this user');
    }

    const businessObjectId = new Types.ObjectId(business._id);
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const [todayBookingsAgg, cancelledToday, completedToday, todaysRevenueAgg] =
      await Promise.all([
        // 1. Today Bookings (Actual service items scheduled for today)
        this.bookingModel.aggregate([
          {
            $match: {
              businessId: businessObjectId,
              isDeleted: false,
              'services.dateAndTime': { $gte: startOfToday, $lte: endOfToday },
            },
          },
          { $unwind: '$services' },
          {
            $match: {
              'services.dateAndTime': { $gte: startOfToday, $lte: endOfToday },
            },
          },
          { $count: 'total' },
        ]),
        // 2. Cancelled Today
        this.bookingModel.countDocuments({
          businessId: businessObjectId,
          isDeleted: false,
          bookingStatus: BookingStatus.CANCELLED,
          cancelledAt: { $gte: startOfToday, $lte: endOfToday },
        }),
        // 3. Completed Today
        this.bookingModel.countDocuments({
          businessId: businessObjectId,
          isDeleted: false,
          bookingStatus: BookingStatus.COMPLETED,
          completedAt: { $gte: startOfToday, $lte: endOfToday },
        }),
        // 4. Today's Revenue (Sum of COMPLETED services today)
        this.bookingModel.aggregate([
          {
            $match: {
              businessId: businessObjectId,
              isDeleted: false,
              bookingStatus: BookingStatus.COMPLETED,
              completedAt: { $gte: startOfToday, $lte: endOfToday },
            },
          },
          { $unwind: '$services' },
          {
            $lookup: {
              from: 'services',
              localField: 'services.serviceId',
              foreignField: '_id',
              as: 'serviceDetail',
            },
          },
          { $unwind: '$serviceDetail' },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$serviceDetail.price' },
            },
          },
        ]),
      ]);

    return {
      todayBookings: todayBookingsAgg[0]?.total || 0,
      cancelled: cancelledToday,
      completed: completedToday,
      todaysRevenue: todaysRevenueAgg[0]?.totalRevenue || 0,
    };
  }

  private parseDurationToMinutes(duration: string): number {
    if (!duration) return 30;
    const raw = String(duration).trim().toLowerCase();
    if (/^\d+$/.test(raw)) return parseInt(raw, 10);
    const hourMatch = /(\d+)\s*(hour|hours|hr|hrs|h)\b/.exec(raw);
    const minuteMatch = /(\d+)\s*(minute|minutes|min|mins|m)\b/.exec(raw);
    const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
    const minutes = minuteMatch ? parseInt(minuteMatch[1], 10) : 0;
    return hours * 60 + minutes || 30;
  }

  async getRevenueChartData(
    ownerId: string,
    viewType: 'yearly' | 'monthly' | 'weekly' = 'yearly',
  ) {
    const business = await this.businessModel
      .findOne({ ownerId, deletedAt: null })
      .select('_id')
      .lean();

    if (!business) {
      throw new NotFoundException('Business not found for this user');
    }

    const businessId = business._id.toString();
    const cacheKey = `dashboard:revenue-chart:${businessId}:${viewType}`;

    // Step 4: Check Cache
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const businessObjectId = new Types.ObjectId(businessId);
    const now = new Date();
    let startDate: Date;

    if (viewType === 'weekly') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
    } else if (viewType === 'monthly') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      startDate.setHours(0, 0, 0, 0);
    }

    // Step 2: Aggregation Pipeline
    const aggResult = await this.bookingModel.aggregate([
      {
        $match: {
          businessId: businessObjectId,
          isDeleted: false,
          bookingStatus: BookingStatus.COMPLETED,
          'services.dateAndTime': { $gte: startDate, $lte: now },
        },
      },
      { $unwind: '$services' },
      {
        $match: {
          'services.dateAndTime': { $gte: startDate, $lte: now },
        },
      },
      {
        $lookup: {
          from: 'services',
          localField: 'services.serviceId',
          foreignField: '_id',
          as: 'serviceInfo',
        },
      },
      { $unwind: '$serviceInfo' },
      {
        $group: {
          _id:
            viewType === 'yearly'
              ? {
                  $dateToString: {
                    format: '%Y-%m',
                    date: '$services.dateAndTime',
                  },
                }
              : {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$services.dateAndTime',
                  },
                },
          totalRevenue: { $sum: '$serviceInfo.price' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Step 3: Gap Filling Logic
    const labels: string[] = [];
    const revenueData: number[] = [];
    const commissionData: number[] = [];
    const payoutData: number[] = [];

    const dataMap = new Map(
      aggResult.map((item) => [item._id, item.totalRevenue]),
    );
    const commissionRate = 0.1; // 10% Platform Commission

    if (viewType === 'weekly' || viewType === 'monthly') {
      const days = viewType === 'weekly' ? 7 : 30;
      for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel =
          viewType === 'weekly'
            ? d.toLocaleDateString('en-US', { weekday: 'short' })
            : d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });

        const rev = dataMap.get(dateStr) || 0;
        labels.push(dayLabel);
        revenueData.push(Number(rev.toFixed(2)));
        commissionData.push(Number((rev * commissionRate).toFixed(2)));
        payoutData.push(Number((rev * (1 - commissionRate)).toFixed(2)));
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const d = new Date(
          startDate.getFullYear(),
          startDate.getMonth() + i,
          1,
        );
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });

        const rev = dataMap.get(dateStr) || 0;
        labels.push(monthLabel);
        revenueData.push(Number(rev.toFixed(2)));
        commissionData.push(Number((rev * commissionRate).toFixed(2)));
        payoutData.push(Number((rev * (1 - commissionRate)).toFixed(2)));
      }
    }

    // Step 5: Frontend Contract Design
    const response = {
      labels,
      datasets: [
        { label: 'Total Revenue', data: revenueData },
        { label: 'Platform Commission', data: commissionData },
        { label: 'Payouts', data: payoutData },
      ],
    };

    // Cache the result for 15 minutes (900 seconds)
    await this.redis.setex(cacheKey, 900, JSON.stringify(response));

    return response;
  }

  async getUpcomingAppointments(ownerId: string) {
    const business = await this.businessModel
      .findOne({ ownerId, deletedAt: null })
      .select('_id')
      .lean();

    if (!business) {
      throw new NotFoundException('Business not found for this user');
    }

    const businessObjectId = new Types.ObjectId(business._id.toString());
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const appointments = await this.bookingModel.aggregate([
      {
        $match: {
          businessId: businessObjectId,
          isDeleted: false,
          bookingStatus: {
            $in: [
              BookingStatus.PENDING,
              BookingStatus.CONFIRMED,
              BookingStatus.IN_PROGRESS,
            ],
          },
        },
      },
      { $unwind: '$services' },
      {
        $match: {
          'services.dateAndTime': { $gte: now, $lte: in48Hours },
        },
      },
      {
        $lookup: {
          from: 'auth_users',
          localField: 'userId',
          foreignField: '_id',
          as: 'clientInfo',
        },
      },
      { $unwind: '$clientInfo' },
      {
        $lookup: {
          from: 'services',
          localField: 'services.serviceId',
          foreignField: '_id',
          as: 'serviceInfo',
        },
      },
      { $unwind: '$serviceInfo' },
      {
        $lookup: {
          from: 'staff_members',
          localField: 'services.selectedProvider',
          foreignField: '_id',
          as: 'staffInfo',
        },
      },
      { $unwind: '$staffInfo' },
      {
        $project: {
          _id: 0,
          bookingId: '$_id',
          serviceItemId: '$services._id',
          clientName: '$clientInfo.fullName',
          serviceType: '$serviceInfo.serviceName',
          staffName: {
            $concat: ['$staffInfo.firstName', ' ', '$staffInfo.lastName'],
          },
          timeAndDate: '$services.dateAndTime',
          status: '$bookingStatus',
        },
      },
      { $sort: { timeAndDate: 1 } },
    ]);

    return appointments;
  }
}
