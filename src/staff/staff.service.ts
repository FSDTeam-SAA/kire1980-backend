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
  StaffMember,
  BusinessInfo,
  Service,
  AuthUser,
  Booking,
  BookingStatus,
} from '../database/schemas';
import { CreateStaffMemberDto } from './dto/create-staff-member.dto';
import { UpdateStaffMemberDto } from './dto/update-staff-member.dto';
import { AvailableStaffQueryDto } from './dto/available-staff-query.dto';
import { CustomLoggerService } from '../common/services/custom-logger.service';
import { CloudinaryService } from '../common/services/cloudinary.service';

@Injectable()
export class StaffService {
  constructor(
    @InjectModel(StaffMember.name)
    private readonly staffModel: Model<StaffMember>,
    @InjectModel(BusinessInfo.name)
    private readonly businessModel: Model<BusinessInfo>,
    @InjectModel(Service.name)
    private readonly serviceModel: Model<Service>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
    @InjectModel(AuthUser.name)
    private readonly authUserModel: Model<AuthUser>,
    private readonly customLogger: CustomLoggerService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(
    userId: string,
    createStaffMemberDto: CreateStaffMemberDto,
    file?: Express.Multer.File,
  ) {
    const businessIdAsObjectId = new Types.ObjectId(
      createStaffMemberDto.businessId,
    );
    const businessIdAsString = createStaffMemberDto.businessId;

    // Verify business exists
    const business = await this.businessModel.findById(
      createStaffMemberDto.businessId,
    );
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // Verify user owns the business
    if (business.ownerId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to add staff to this business',
      );
    }

    // Check if email already exists for this business
    const existingStaff = await this.staffModel.findOne({
      email: createStaffMemberDto.email,
      businessId: businessIdAsObjectId,
      isDeleted: false,
    });

    if (existingStaff) {
      throw new ConflictException(
        'A staff member with this email already exists for this business',
      );
    }

    // Verify all service IDs belong to the business
    if (createStaffMemberDto.serviceIds?.length) {
      const uniqueServiceIds = [...new Set(createStaffMemberDto.serviceIds)];
      const services = await this.serviceModel.find({
        _id: { $in: uniqueServiceIds },
        businessId: { $in: [businessIdAsObjectId, businessIdAsString] },
      });

      if (services.length !== uniqueServiceIds.length) {
        throw new BadRequestException(
          'One or more service IDs are invalid or do not belong to this business',
        );
      }
    }

    // Upload avatar if provided
    let avatarData;
    if (file) {
      const uploadResult = await this.cloudinaryService.uploadImage(
        file.buffer,
        'staff-avatars',
      );
      avatarData = {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        uploadedAt: new Date(),
      };
    }

    // Create staff member
    const staffMember = await this.staffModel.create({
      firstName: createStaffMemberDto.firstName,
      lastName: createStaffMemberDto.lastName,
      email: createStaffMemberDto.email,
      phoneNumber: createStaffMemberDto.phoneNumber,
      businessId: businessIdAsObjectId,
      serviceIds:
        createStaffMemberDto.serviceIds?.map((id) => new Types.ObjectId(id)) ||
        [],
      description: createStaffMemberDto.description,
      schedule: createStaffMemberDto.schedule,
      avatar: avatarData,
    });

    this.customLogger.log(
      `Staff member ${staffMember._id} created for business ${createStaffMemberDto.businessId}`,
      StaffService.name,
    );

    return staffMember;
  }

  async findAll(
    page = 1,
    limit = 10,
    businessId?: string,
    serviceId?: string,
    isActive?: boolean,
  ) {
    const filter: any = { isDeleted: false };

    if (businessId) {
      filter.businessId = new Types.ObjectId(businessId);
    }

    if (serviceId) {
      filter.serviceIds = new Types.ObjectId(serviceId);
    }

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    const skip = (page - 1) * limit;

    const [staffMembers, total] = await Promise.all([
      this.staffModel
        .find(filter)
        .populate('businessId', 'businessName')
        .populate('serviceIds', 'serviceName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.staffModel.countDocuments(filter),
    ]);

    return {
      data: staffMembers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid staff member ID');
    }

    const staffMember = await this.staffModel
      .findOne({ _id: id, isDeleted: false })
      .populate('businessId', 'businessName businessEmail phoneNumber')
      .populate('serviceIds', 'serviceName category price')
      .lean();

    if (!staffMember) {
      throw new NotFoundException('Staff member not found');
    }

    // Fetch recent bookings for this staff member
    const recentBookings = await this.bookingModel.aggregate([
      {
        $match: {
          'services.selectedProvider': new Types.ObjectId(id),
          isDeleted: { $ne: true },
        },
      },
      { $unwind: '$services' },
      {
        $match: {
          'services.selectedProvider': new Types.ObjectId(id),
        },
      },
      {
        $lookup: {
          from: 'auth_users',
          localField: 'userId',
          foreignField: '_id',
          as: 'customer',
        },
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'services',
          localField: 'services.serviceId',
          foreignField: '_id',
          as: 'serviceInfo',
        },
      },
      { $unwind: { path: '$serviceInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          customerName: { $ifNull: ['$customer.fullName', 'Unknown Customer'] },
          serviceName: {
            $ifNull: ['$serviceInfo.serviceName', 'Unknown Service'],
          },
          dateAndTime: '$services.dateAndTime',
          status: '$bookingStatus',
        },
      },
      { $sort: { dateAndTime: -1 } },
      { $limit: 10 },
    ]);

    return {
      ...staffMember,
      recentBookings,
    };
  }

  async findByBusiness(businessId: string, page = 1, limit = 10) {
    if (!Types.ObjectId.isValid(businessId)) {
      throw new BadRequestException('Invalid business ID');
    }

    const skip = (page - 1) * limit;

    const [staffMembers, total] = await Promise.all([
      this.staffModel
        .find({
          businessId: new Types.ObjectId(businessId),
          isDeleted: false,
        })
        .populate('serviceIds', 'serviceName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.staffModel.countDocuments({
        businessId: new Types.ObjectId(businessId),
        isDeleted: false,
      }),
    ]);

    return {
      data: staffMembers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBusinessOwnerDashboardStatistics(ownerId: string): Promise<{
    totalStaff: number;
    currentlyOnDuty: number;
    totalBookings: number;
  }> {
    const business = await this.businessModel
      .findOne({ ownerId, deletedAt: null })
      .select('_id')
      .lean();

    if (!business) {
      throw new NotFoundException('Business not found for this user');
    }

    const businessObjectId =
      business._id instanceof Types.ObjectId
        ? business._id
        : new Types.ObjectId(business._id as string);

    const now = new Date();

    const activeBookingStatuses = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
    ];

    const [totalStaff, totalBookings, bookingItems] = await Promise.all([
      this.staffModel.countDocuments({
        businessId: businessObjectId,
        isDeleted: false,
      }),
      this.bookingModel.countDocuments({
        businessId: businessObjectId,
        isDeleted: false,
      }),
      this.bookingModel.aggregate<{
        selectedProvider: Types.ObjectId;
        serviceId: Types.ObjectId;
        dateAndTime: Date;
      }>([
        {
          $match: {
            businessId: businessObjectId,
            isDeleted: false,
            bookingStatus: { $in: activeBookingStatuses },
            services: {
              $elemMatch: {
                dateAndTime: { $lte: now },
              },
            },
          },
        },
        { $unwind: '$services' },
        {
          $match: {
            'services.dateAndTime': { $lte: now },
          },
        },
        {
          $project: {
            _id: 0,
            selectedProvider: '$services.selectedProvider',
            serviceId: '$services.serviceId',
            dateAndTime: '$services.dateAndTime',
          },
        },
      ]),
    ]);

    if (!bookingItems.length) {
      return {
        totalStaff,
        currentlyOnDuty: 0,
        totalBookings,
      };
    }

    const uniqueServiceIds = [
      ...new Set(bookingItems.map((item) => item.serviceId.toString())),
    ];

    const services = await this.serviceModel
      .find({ _id: { $in: uniqueServiceIds } })
      .select('_id serviceDuration')
      .lean();

    const serviceDurationMap = new Map<string, number>(
      services.map((service) => [
        service._id.toString(),
        this.parseServiceDurationToMinutes(service.serviceDuration),
      ]),
    );

    const candidateStaffIds = [
      ...new Set(bookingItems.map((item) => item.selectedProvider.toString())),
    ];

    const activeStaff = await this.staffModel
      .find({
        _id: { $in: candidateStaffIds },
        businessId: businessObjectId,
        isDeleted: false,
        isActive: true,
      })
      .select('_id')
      .lean();

    const activeStaffIdSet = new Set(
      activeStaff.map((staff) => staff._id.toString()),
    );

    const onDutyStaffIdSet = new Set<string>();

    for (const bookingItem of bookingItems) {
      const staffId = bookingItem.selectedProvider.toString();

      if (!activeStaffIdSet.has(staffId)) {
        continue;
      }

      const start = new Date(bookingItem.dateAndTime);
      const durationMinutes =
        serviceDurationMap.get(bookingItem.serviceId.toString()) ?? 30;
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      if (start <= now && now < end) {
        onDutyStaffIdSet.add(staffId);
      }
    }

    return {
      totalStaff,
      currentlyOnDuty: onDutyStaffIdSet.size,
      totalBookings,
    };
  }

  async update(
    id: string,
    userId: string,
    updateStaffMemberDto: UpdateStaffMemberDto,
    file?: Express.Multer.File,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid staff member ID');
    }

    const staffMember = await this.staffModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!staffMember) {
      throw new NotFoundException('Staff member not found');
    }

    // Verify user owns the business
    const business = await this.businessModel.findById(staffMember.businessId);
    if (!business || business.ownerId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to update this staff member',
      );
    }

    // Verify service IDs if being updated
    if (updateStaffMemberDto.serviceIds?.length) {
      const uniqueServiceIds = [...new Set(updateStaffMemberDto.serviceIds)];
      const services = await this.serviceModel.find({
        _id: { $in: uniqueServiceIds },
        businessId: {
          $in: [staffMember.businessId, staffMember.businessId.toString()],
        },
      });

      if (services.length !== uniqueServiceIds.length) {
        throw new BadRequestException(
          'One or more service IDs are invalid or do not belong to this business',
        );
      }

      updateStaffMemberDto.serviceIds = updateStaffMemberDto.serviceIds.map(
        (id) => new Types.ObjectId(id) as any,
      );
    }

    // Handle avatar update
    if (file) {
      // Delete old avatar if exists
      if (staffMember.avatar?.publicId) {
        await this.cloudinaryService.deleteImage(staffMember.avatar.publicId);
      }

      // Upload new avatar
      const uploadResult = await this.cloudinaryService.uploadImage(
        file.buffer,
        'staff-avatars',
      );

      (updateStaffMemberDto as any).avatar = {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        uploadedAt: new Date(),
      };
    }

    // Update staff member
    Object.assign(staffMember, updateStaffMemberDto);
    await staffMember.save();

    this.customLogger.log(
      `Staff member ${id} updated by user ${userId}`,
      StaffService.name,
    );

    return staffMember;
  }

  async remove(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid staff member ID');
    }

    const staffMember = await this.staffModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!staffMember) {
      throw new NotFoundException('Staff member not found');
    }

    // Verify user owns the business
    const business = await this.businessModel.findById(staffMember.businessId);
    if (!business || business.ownerId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to delete this staff member',
      );
    }

    // Soft delete
    staffMember.isDeleted = true;
    staffMember.isActive = false;
    await staffMember.save();

    // Optionally delete avatar from Cloudinary
    if (staffMember.avatar?.publicId) {
      await this.cloudinaryService.deleteImage(staffMember.avatar.publicId);
    }

    this.customLogger.log(
      `Staff member ${id} deleted by user ${userId}`,
      StaffService.name,
    );

    return { message: 'Staff member deleted successfully' };
  }

  async toggleActiveStatus(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid staff member ID');
    }

    const staffMember = await this.staffModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!staffMember) {
      throw new NotFoundException('Staff member not found');
    }

    // Verify user owns the business
    const business = await this.businessModel.findById(staffMember.businessId);
    if (!business || business.ownerId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to update this staff member',
      );
    }

    staffMember.isActive = !staffMember.isActive;
    await staffMember.save();

    this.customLogger.log(
      `Staff member ${id} status toggled to ${staffMember.isActive}`,
      StaffService.name,
    );

    return {
      message: `Staff member ${staffMember.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: staffMember.isActive,
    };
  }

  async findAvailableStaffForService(
    serviceId: string,
    query: AvailableStaffQueryDto,
  ) {
    if (!Types.ObjectId.isValid(serviceId)) {
      throw new BadRequestException('Invalid service ID');
    }

    const requestedStartTime = this.parseRequestedDateTime(
      query.date,
      query.time,
    );
    const requestedDay = requestedStartTime
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase();

    const service = await this.serviceModel
      .findById(serviceId)
      .select('_id serviceDuration')
      .lean();

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const requestedDurationMinutes = this.parseServiceDurationToMinutes(
      service.serviceDuration,
    );

    const requestedEndTime = new Date(
      requestedStartTime.getTime() + requestedDurationMinutes * 60 * 1000,
    );

    const staffAssignedToService = await this.staffModel
      .find({
        serviceIds: new Types.ObjectId(serviceId),
        isActive: true,
        isDeleted: false,
      })
      .select('_id firstName lastName schedule')
      .lean();

    const scheduleMatchedStaff = staffAssignedToService.filter((staff: any) =>
      this.isStaffScheduledForTime(staff.schedule, requestedDay, query.time),
    );

    if (!scheduleMatchedStaff.length) {
      return {
        date: query.date,
        serviceId,
        availableStaff: [],
      };
    }

    const candidateStaffIds = scheduleMatchedStaff.map((staff: any) =>
      staff._id instanceof Types.ObjectId
        ? staff._id
        : new Types.ObjectId(staff._id as string),
    );

    const dayStart = new Date(requestedStartTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const activeBookingStatuses = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
    ];

    const bookingItems = await this.bookingModel.aggregate<{
      selectedProvider: Types.ObjectId;
      serviceId: Types.ObjectId;
      dateAndTime: Date;
    }>([
      {
        $match: {
          isDeleted: false,
          bookingStatus: { $in: activeBookingStatuses },
          services: {
            $elemMatch: {
              selectedProvider: { $in: candidateStaffIds },
              dateAndTime: { $gte: dayStart, $lt: dayEnd },
            },
          },
        },
      },
      { $unwind: '$services' },
      {
        $match: {
          'services.selectedProvider': { $in: candidateStaffIds },
          'services.dateAndTime': { $gte: dayStart, $lt: dayEnd },
        },
      },
      {
        $project: {
          _id: 0,
          selectedProvider: '$services.selectedProvider',
          serviceId: '$services.serviceId',
          dateAndTime: '$services.dateAndTime',
        },
      },
    ]);

    const bookedServiceIds = [
      ...new Set(bookingItems.map((item) => item.serviceId.toString())),
    ];

    const bookedServices = bookedServiceIds.length
      ? await this.serviceModel
          .find({ _id: { $in: bookedServiceIds } })
          .select('_id serviceDuration')
          .lean()
      : [];

    const durationEntries: Array<[string, number]> = [
      [serviceId, requestedDurationMinutes],
      ...bookedServices.map((bookedService): [string, number] => [
        bookedService._id.toString(),
        this.parseServiceDurationToMinutes(bookedService.serviceDuration),
      ]),
    ];
    const durationMap = new Map<string, number>(durationEntries);

    const busyStaffIdSet = new Set<string>();

    for (const bookingItem of bookingItems) {
      const bookingStart = new Date(bookingItem.dateAndTime);
      const bookingDurationMinutes =
        durationMap.get(bookingItem.serviceId.toString()) ?? 30;
      const bookingEnd = new Date(
        bookingStart.getTime() + bookingDurationMinutes * 60 * 1000,
      );

      const hasOverlap =
        bookingStart < requestedEndTime && requestedStartTime < bookingEnd;

      if (hasOverlap) {
        busyStaffIdSet.add(bookingItem.selectedProvider.toString());
      }
    }

    const availableStaff = scheduleMatchedStaff
      .filter((staff: any) => !busyStaffIdSet.has(staff._id.toString()))
      .map((staff: any) => ({
        id: staff._id.toString(),
        name: `${staff.firstName} ${staff.lastName}`.trim(),
      }));

    return {
      date: query.date,
      serviceId,
      availableStaff,
    };
  }

  private parseRequestedDateTime(date: string, time: string): Date {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);

    if (!dateMatch || !timeMatch) {
      throw new BadRequestException('Invalid date or time format');
    }

    const year = Number.parseInt(dateMatch[1], 10);
    const month = Number.parseInt(dateMatch[2], 10);
    const day = Number.parseInt(dateMatch[3], 10);
    const hour = Number.parseInt(timeMatch[1], 10);
    const minute = Number.parseInt(timeMatch[2], 10);

    const parsedDate = new Date(year, month - 1, day, hour, minute, 0, 0);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getDate() !== day
    ) {
      throw new BadRequestException('Invalid date value');
    }

    return parsedDate;
  }

  private parseServiceDurationToMinutes(serviceDuration: string): number {
    if (!serviceDuration) {
      return 30;
    }

    const raw = String(serviceDuration).trim().toLowerCase();

    if (/^\d+$/.test(raw)) {
      return Number.parseInt(raw, 10);
    }

    if (/^\d{1,2}:\d{2}$/.test(raw)) {
      const [hours, minutes] = raw
        .split(':')
        .map((value) => Number.parseInt(value, 10));
      return hours * 60 + minutes;
    }

    const hourMatch = /(\d+)\s*(hour|hours|hr|hrs|h)\b/.exec(raw);
    const minuteMatch = /(\d+)\s*(minute|minutes|min|mins|m)\b/.exec(raw);

    const hours = hourMatch ? Number.parseInt(hourMatch[1], 10) : 0;
    const minutes = minuteMatch ? Number.parseInt(minuteMatch[1], 10) : 0;
    const total = hours * 60 + minutes;

    return total > 0 ? total : 30;
  }

  public isStaffScheduledForTime(
    schedule:
      | Array<{
          day: string;
          from?: string;
          to?: string;
          isAvailable?: boolean;
        }>
      | undefined,
    requestedDay: string,
    requestedTime: string,
  ): boolean {
    if (!Array.isArray(schedule) || !schedule.length) {
      return false;
    }

    const requestedMinutes = this.timeToMinutes(requestedTime);
    if (requestedMinutes === null) {
      return false;
    }

    return schedule.some((slot) => {
      const normalizedSlotDay = this.normalizeDayName(slot.day);
      if (normalizedSlotDay !== requestedDay) {
        return false;
      }

      // If isAvailable is explicitly false, they are not working this day
      if (slot.isAvailable === false) {
        return false;
      }

      // If they are available (default), check if the requested time falls within from/to
      if (slot.from && slot.to) {
        const fromMinutes = this.timeToMinutes(slot.from);
        const toMinutes = this.timeToMinutes(slot.to);

        if (fromMinutes === null || toMinutes === null) {
          return false;
        }

        if (fromMinutes <= toMinutes) {
          return (
            requestedMinutes >= fromMinutes && requestedMinutes < toMinutes
          );
        }

        return requestedMinutes >= fromMinutes || requestedMinutes < toMinutes;
      }

      // If isAvailable is true but no times provided, assume available
      return true;
    });
  }

  private normalizeDayName(day: string): string {
    const normalized = String(day || '')
      .trim()
      .toLowerCase();

    const dayMap: Record<string, string> = {
      mon: 'monday',
      monday: 'monday',
      tue: 'tuesday',
      tues: 'tuesday',
      tuesday: 'tuesday',
      wed: 'wednesday',
      wednesday: 'wednesday',
      thu: 'thursday',
      thur: 'thursday',
      thurs: 'thursday',
      thursday: 'thursday',
      fri: 'friday',
      friday: 'friday',
      sat: 'saturday',
      saturday: 'saturday',
      sun: 'sunday',
      sunday: 'sunday',
    };

    return dayMap[normalized] ?? normalized;
  }

  private timeToMinutes(time: string): number | null {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time || '').trim());
    if (!match) {
      return null;
    }

    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    return hours * 60 + minutes;
  }
}
