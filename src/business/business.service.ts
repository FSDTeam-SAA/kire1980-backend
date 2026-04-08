import {
  BadRequestException,
  ForbiddenException,
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

    const [todaysBookings, newCustomersAgg, monthlyRevenueAgg, avgRatingAgg] =
      await Promise.all([
        this.bookingModel.countDocuments({
          businessId: businessObjectId,
          isDeleted: false,
          bookingStatus: {
            $nin: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
          },
          services: {
            $elemMatch: {
              dateAndTime: {
                $gte: startOfToday,
                $lte: endOfToday,
              },
            },
          },
        }),

        this.bookingModel.aggregate([
          {
            $match: {
              businessId: businessObjectId,
              isDeleted: false,
              bookingStatus: {
                $nin: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
              },
              createdAt: {
                $gte: startOfMonth,
                $lte: endOfMonth,
              },
            },
          },
          {
            $group: {
              _id: '$userId',
            },
          },
          {
            $count: 'total',
          },
        ]),

        this.bookingModel.aggregate([
          {
            $match: {
              businessId: businessObjectId,
              isDeleted: false,
              bookingStatus: BookingStatus.COMPLETED,
              completedAt: {
                $gte: startOfMonth,
                $lte: endOfMonth,
              },
            },
          },
          { $unwind: '$services' },
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
              totalRevenue: { $sum: '$serviceInfo.price' },
            },
          },
        ]),

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

    const newCustomers = newCustomersAgg[0]?.total ?? 0;
    const monthlyRevenue = Number(
      (monthlyRevenueAgg[0]?.totalRevenue ?? 0).toFixed(2),
    );
    const averageRating = Number((avgRatingAgg[0]?.avgRating ?? 0).toFixed(1));

    return {
      newCustomers,
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
              $cond: [{ $eq: ['$bookingStatus', BookingStatus.COMPLETED] }, 1, 0],
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
}
