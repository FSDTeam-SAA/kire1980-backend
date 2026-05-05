import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  Booking,
  BookingStatus,
  BusinessInfo,
  Service,
  StaffMember,
  AuthUser,
} from '../database/schemas';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CustomLoggerService } from '../common/services/custom-logger.service';
import { StaffService } from '../staff/staff.service';
import { EmailQueueService } from '../common/queues/email/email.queue';
import { SmsQueueService } from '../common/queues/sms/sms.queue';

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
    @InjectModel(BusinessInfo.name)
    private readonly businessModel: Model<BusinessInfo>,
    @InjectModel(Service.name)
    private readonly serviceModel: Model<Service>,
    @InjectModel(StaffMember.name)
    private readonly staffModel: Model<StaffMember>,
    @InjectModel(AuthUser.name)
    private readonly authUserModel: Model<AuthUser>,
    private readonly customLogger: CustomLoggerService,
    private readonly staffService: StaffService,
    private readonly emailQueueService: EmailQueueService,
    private readonly smsQueueService: SmsQueueService,
  ) {}

  async create(userId: string, createBookingDto: CreateBookingDto) {
    // Verify user exists
    const user = await this.authUserModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify business exists
    const business = await this.businessModel.findById(
      createBookingDto.businessId,
    );
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const businessOwner = await this.authUserModel.findById(business.ownerId);

    const normalizedBusinessId = new Types.ObjectId(
      createBookingDto.businessId,
    );
    const seenSlots = new Set<string>();

    for (const bookingItem of createBookingDto.services) {
      // Verify service exists and belongs to the business
      const service = await this.serviceModel.findById(bookingItem.serviceId);
      if (!service) {
        throw new NotFoundException(
          `Service not found: ${bookingItem.serviceId}`,
        );
      }

      if (service.businessId.toString() !== createBookingDto.businessId) {
        throw new BadRequestException(
          `Service ${bookingItem.serviceId} does not belong to the specified business`,
        );
      }

      // Verify staff member exists and is assigned to the service
      const staffMember = await this.staffModel.findOne({
        _id: bookingItem.selectedProvider,
        businessId: normalizedBusinessId,
        isDeleted: false,
        isActive: true,
      });

      if (!staffMember) {
        throw new NotFoundException(
          `Staff member not found or inactive: ${bookingItem.selectedProvider}`,
        );
      }

      if (
        !staffMember.serviceIds.some(
          (id) => id.toString() === bookingItem.serviceId,
        )
      ) {
        throw new BadRequestException(
          `Selected provider ${bookingItem.selectedProvider} is not assigned to service ${bookingItem.serviceId}`,
        );
      }

      // Check Staff Availability (Schedule)
      const bookingDate = new Date(bookingItem.dateAndTime);
      const requestedDayStr = bookingDate
        .toLocaleDateString('en-US', { weekday: 'long' })
        .toLowerCase();
      const requestedTimeStr = bookingDate
        .toTimeString()
        .split(' ')[0]
        .slice(0, 5); // HH:mm

      const isAvailable = this.staffService.isStaffScheduledForTime(
        staffMember.schedule,
        requestedDayStr,
        requestedTimeStr,
      );

      if (!isAvailable) {
        throw new ConflictException(
          `Staff member ${staffMember.firstName} is not available on ${requestedDayStr} at ${requestedTimeStr}`,
        );
      }

      // Prevent duplicate provider+time combinations in same request
      const slotKey = `${bookingItem.selectedProvider}_${new Date(bookingItem.dateAndTime).toISOString()}`;
      if (seenSlots.has(slotKey)) {
        throw new ConflictException(
          'Duplicate provider and time slot found in services payload',
        );
      }
      seenSlots.add(slotKey);

      // Check for time slot conflicts
      const conflictingBooking = await this.bookingModel.findOne({
        services: {
          $elemMatch: {
            selectedProvider: new Types.ObjectId(bookingItem.selectedProvider),
            dateAndTime: bookingItem.dateAndTime,
          },
        },
        bookingStatus: {
          $in: [
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.IN_PROGRESS,
          ],
        },
        isDeleted: false,
      });

      if (conflictingBooking) {
        throw new ConflictException(
          `Time slot already booked for provider ${bookingItem.selectedProvider}`,
        );
      }
    }

    // Create booking
    const booking = await this.bookingModel.create({
      userId: new Types.ObjectId(userId),
      businessId: normalizedBusinessId,
      services: createBookingDto.services.map((bookingItem) => ({
        serviceId: new Types.ObjectId(bookingItem.serviceId),
        dateAndTime: bookingItem.dateAndTime,
        selectedProvider: new Types.ObjectId(bookingItem.selectedProvider),
      })),
      notes: createBookingDto.notes,
      bookingStatus: BookingStatus.PENDING,
    });

    this.customLogger.log(
      `Booking ${booking._id.toString()} created by user ${userId}`,
      BookingService.name,
    );

    const bookingId = booking._id.toString();
    const customerName = user.fullName;
    const businessName = business.businessName;
    const businessOwnerEmail = businessOwner?.email ?? business.businessEmail;
    const businessOwnerPhoneNumber =
      businessOwner?.phoneNumber ?? business.phoneNumber;
    const firstServiceDateTime =
      createBookingDto.services[0]?.dateAndTime.toISOString() ||
      new Date().toISOString();

    try {
      await this.emailQueueService.sendBookingCreatedNotificationEmails({
        customerEmail: user.email,
        customerName,
        businessEmail: businessOwnerEmail,
        businessName,
        bookingId,
        firstServiceDateTime,
        totalServices: createBookingDto.services.length,
      });
    } catch (error) {
      this.customLogger.error(
        `Failed to queue booking created emails for booking ${bookingId}`,
        error instanceof Error ? error.stack : undefined,
        BookingService.name,
      );
    }

    if (!user.phoneNumber) {
      this.customLogger.warn(
        `Customer phone number missing for booking ${bookingId}; customer SMS skipped`,
        BookingService.name,
      );
    }

    if (!businessOwnerPhoneNumber) {
      this.customLogger.warn(
        `Business owner phone number missing for booking ${bookingId}; business SMS skipped`,
        BookingService.name,
      );
    }

    try {
      await this.smsQueueService.sendBookingCreatedNotificationSms({
        customerPhoneNumber: user.phoneNumber,
        customerName,
        businessPhoneNumber: businessOwnerPhoneNumber,
        businessName,
        bookingId,
        firstServiceDateTime,
      });
    } catch (error) {
      this.customLogger.error(
        `Failed to queue booking created SMS for booking ${bookingId}`,
        error instanceof Error ? error.stack : undefined,
        BookingService.name,
      );
    }

    return booking;
  }

  async findAll(
    page = 1,
    limit = 10,
    userId?: string,
    businessId?: string,
    status?: BookingStatus,
    title?: string,
    serviceTitle?: string,
  ) {
    const filter: FilterQuery<Booking> = { isDeleted: false };

    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    }

    if (businessId) {
      filter.businessId = new Types.ObjectId(businessId);
    }

    if (title?.trim()) {
      const matchedBusinesses = await this.businessModel
        .find({
          businessName: { $regex: title.trim(), $options: 'i' },
        })
        .select('_id')
        .lean();

      if (matchedBusinesses.length === 0) {
        return {
          data: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }

      filter.businessId = {
        $in: matchedBusinesses.map((business) => business._id),
      };
    }

    if (status) {
      filter.bookingStatus = status;
    }

    if (serviceTitle?.trim()) {
      const matchedServices = await this.serviceModel
        .find({
          serviceName: { $regex: serviceTitle.trim(), $options: 'i' },
        })
        .select('_id')
        .lean();

      if (matchedServices.length === 0) {
        return {
          data: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }

      (filter as Record<string, unknown>)['services.serviceId'] = {
        $in: matchedServices.map((service) => service._id),
      };
    }

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.bookingModel
        .find(filter)
        .populate('userId', 'email firstName lastName')
        .populate('services.serviceId', 'serviceName price serviceDuration')
        .populate('businessId', 'businessName businessEmail phoneNumber')
        .populate('services.selectedProvider', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.bookingModel.countDocuments(filter),
    ]);

    return {
      data: bookings,
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
      throw new BadRequestException('Invalid booking ID');
    }

    const booking = await this.bookingModel
      .findOne({ _id: id, isDeleted: false })
      .populate('userId', 'email firstName lastName phoneNumber')
      .populate(
        'services.serviceId',
        'serviceName price serviceDuration description',
      )
      .populate('businessId', 'businessName businessEmail phoneNumber address')
      .populate(
        'services.selectedProvider',
        'firstName lastName email phoneNumber avatar',
      )
      .lean();

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async findUserBookings(userId: string, page = 1, limit = 10) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.bookingModel
        .find({ userId: new Types.ObjectId(userId), isDeleted: false })
        .populate('services.serviceId', 'serviceName price serviceDuration')
        .populate('businessId', 'businessName')
        .populate('services.selectedProvider', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.bookingModel.countDocuments({
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      }),
    ]);

    return {
      data: bookings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findBusinessBookings(businessId: string, page = 1, limit = 10) {
    if (!Types.ObjectId.isValid(businessId)) {
      throw new BadRequestException('Invalid business ID');
    }

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.bookingModel
        .find({ businessId: new Types.ObjectId(businessId), isDeleted: false })
        .populate('userId', 'email firstName lastName phoneNumber')
        .populate('services.serviceId', 'serviceName price')
        .populate('services.selectedProvider', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.bookingModel.countDocuments({
        businessId: new Types.ObjectId(businessId),
        isDeleted: false,
      }),
    ]);

    return {
      data: bookings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, userId: string, updateBookingDto: UpdateBookingDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid booking ID');
    }

    const booking = await this.bookingModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Only the user who created the booking can update it (for customer side)
    // Or business owner can update it (for business side)
    const isOwner = booking.userId.toString() === userId;

    if (!isOwner) {
      // Check if user is the business owner
      const business = await this.businessModel.findById(booking.businessId);
      if (!business || business.ownerId.toString() !== userId) {
        throw new ForbiddenException(
          'You are not authorized to update this booking',
        );
      }
    }

    // Validate status transitions
    if (updateBookingDto.bookingStatus) {
      this.validateStatusTransition(
        booking.bookingStatus,
        updateBookingDto.bookingStatus,
      );
    }

    // Update timestamp fields based on status
    if (updateBookingDto.bookingStatus === BookingStatus.CONFIRMED) {
      (updateBookingDto as any).confirmedAt = new Date();
    } else if (updateBookingDto.bookingStatus === BookingStatus.COMPLETED) {
      (updateBookingDto as any).completedAt = new Date();
    } else if (updateBookingDto.bookingStatus === BookingStatus.CANCELLED) {
      (updateBookingDto as any).cancelledAt = new Date();
    }

    // Update booking
    Object.assign(booking, updateBookingDto);
    await booking.save();

    this.customLogger.log(
      `Booking ${id} updated by user ${userId}`,
      BookingService.name,
    );

    return booking;
  }

  async cancelBooking(id: string, userId: string, cancellationReason?: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid booking ID');
    }

    const booking = await this.bookingModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Check authorization
    const isOwner = booking.userId.toString() === userId;
    if (!isOwner) {
      const business = await this.businessModel.findById(booking.businessId);
      if (!business || business.ownerId.toString() !== userId) {
        throw new ForbiddenException(
          'You are not authorized to cancel this booking',
        );
      }
    }

    // Validate can be cancelled
    if (
      booking.bookingStatus === BookingStatus.COMPLETED ||
      booking.bookingStatus === BookingStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel a booking with status: ${booking.bookingStatus}`,
      );
    }

    booking.bookingStatus = BookingStatus.CANCELLED;
    booking.cancelledAt = new Date();
    if (cancellationReason) {
      booking.cancellationReason = cancellationReason;
    }
    await booking.save();

    this.customLogger.log(
      `Booking ${id} cancelled by user ${userId}`,
      BookingService.name,
    );

    return { message: 'Booking cancelled successfully', booking };
  }

  async completeBooking(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid booking ID');
    }

    const booking = await this.bookingModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Only business owner can mark as completed
    const business = await this.businessModel.findById(booking.businessId);
    if (!business || business.ownerId.toString() !== userId) {
      throw new ForbiddenException(
        'Only the business owner can mark a booking as completed',
      );
    }

    // Must be IN_PROGRESS to complete
    if (booking.bookingStatus !== BookingStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot complete a booking with status: ${booking.bookingStatus}. Booking must be in_progress first.`,
      );
    }

    booking.bookingStatus = BookingStatus.COMPLETED;
    booking.completedAt = new Date();
    await booking.save();

    this.customLogger.log(
      `Booking ${id} marked as completed by business owner ${userId}`,
      BookingService.name,
    );

    return { message: 'Booking marked as completed', booking };
  }

  async remove(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid booking ID');
    }

    const booking = await this.bookingModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Check authorization
    const isOwner = booking.userId.toString() === userId;
    if (!isOwner) {
      const business = await this.businessModel.findById(booking.businessId);
      if (!business || business.ownerId.toString() !== userId) {
        throw new ForbiddenException(
          'You are not authorized to delete this booking',
        );
      }
    }

    // Soft delete
    booking.isDeleted = true;
    await booking.save();

    this.customLogger.log(
      `Booking ${id} deleted by user ${userId}`,
      BookingService.name,
    );

    return { message: 'Booking deleted successfully' };
  }

  private validateStatusTransition(
    currentStatus: BookingStatus,
    newStatus: BookingStatus,
  ): void {
    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.PENDING]: [
        BookingStatus.CONFIRMED,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.CONFIRMED]: [
        BookingStatus.IN_PROGRESS,
        BookingStatus.CANCELLED,
        BookingStatus.NO_SHOW,
      ],
      [BookingStatus.IN_PROGRESS]: [
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.COMPLETED]: [],
      [BookingStatus.CANCELLED]: [],
      [BookingStatus.NO_SHOW]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  async createManualBooking(
    businessOwnerId: string,
    createManualBookingDto: any,
  ) {
    // 1. Verify business owner exists and has a business
    const businessOwner = await this.authUserModel.findById(businessOwnerId);
    if (!businessOwner) {
      throw new NotFoundException('Business owner not found');
    }

    if (!businessOwner.businessId) {
      throw new ForbiddenException(
        'You do not have a business associated with your account',
      );
    }

    // 2. Verify business exists
    const business = await this.businessModel.findById(
      businessOwner.businessId,
    );
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // 3. Verify all services belong to this business
    for (const service of createManualBookingDto.services) {
      const serviceDoc = await this.serviceModel.findById(service.serviceId);
      if (!serviceDoc) {
        throw new NotFoundException(`Service ${service.serviceId} not found`);
      }

      if (serviceDoc.businessId.toString() !== business._id.toString()) {
        throw new BadRequestException(
          `Service ${service.serviceId} does not belong to your business`,
        );
      }

      if (!serviceDoc.isActive) {
        throw new BadRequestException(
          `Service ${service.serviceId} is not active`,
        );
      }
    }

    // 4. Verify all staff members belong to this business
    for (const service of createManualBookingDto.services) {
      const staffMember = await this.staffModel.findById(
        service.selectedProvider,
      );
      if (!staffMember) {
        throw new NotFoundException(
          `Staff member ${service.selectedProvider} not found`,
        );
      }

      if (staffMember.businessId.toString() !== business._id.toString()) {
        throw new BadRequestException(
          `Staff member does not belong to your business`,
        );
      }

      if (!staffMember.isActive) {
        throw new BadRequestException(`Staff member is not active`);
      }
    }

    // 5. Verify booking dates are in future
    const now = new Date();
    for (const service of createManualBookingDto.services) {
      const bookingDate = new Date(service.dateAndTime);
      if (bookingDate <= now) {
        throw new BadRequestException(
          'Booking date and time must be in the future',
        );
      }
    }

    // 6. Find or create customer
    let customerId: string;

    if (createManualBookingDto.customerId) {
      // Existing customer
      const customer = await this.authUserModel.findById(
        createManualBookingDto.customerId,
      );
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
      customerId = customer._id.toString();
    } else if (
      createManualBookingDto.customerEmail ||
      createManualBookingDto.customerPhone
    ) {
      // Find or create new customer
      let customer = await this.authUserModel.findOne({
        email: createManualBookingDto.customerEmail,
      });

      if (!customer) {
        // Create new customer (basic info only)
        customer = await this.authUserModel.create({
          email: createManualBookingDto.customerEmail,
          fullName: createManualBookingDto.customerName || 'Customer',
          phoneNumber: createManualBookingDto.customerPhone,
          role: 'customer',
          status: 'ACTIVE',
          password: Math.random().toString(36).substring(7), // Temporary password
        });
      }

      customerId = customer._id.toString();
    } else {
      throw new BadRequestException(
        'Either customerId or customerEmail/customerPhone must be provided',
      );
    }

    // 7. Create booking with CONFIRMED status by default
    const booking = await this.bookingModel.create({
      userId: new Types.ObjectId(customerId),
      businessId: new Types.ObjectId(business._id),
      services: createManualBookingDto.services.map((service: any) => ({
        serviceId: new Types.ObjectId(service.serviceId),
        dateAndTime: new Date(service.dateAndTime),
        selectedProvider: new Types.ObjectId(service.selectedProvider),
      })),
      bookingStatus: 'confirmed', // ✅ CONFIRMED by default for manual bookings
      notes:
        createManualBookingDto.notes ||
        'Manual booking created by business owner',
      confirmedAt: new Date(),
      isDeleted: false,
    });

    this.customLogger.log(
      `Manual booking created by business owner ${businessOwnerId} for customer ${customerId}`,
      BookingService.name,
    );

    // 8. Send notification to customer and business
    try {
      const customer = await this.authUserModel.findById(customerId);
      await this.emailQueueService.sendBookingCreatedNotificationEmails({
        customerEmail: customer?.email || '',
        customerName: customer?.fullName || 'Customer',
        businessEmail: business.businessEmail || '',
        businessName: business.businessName,
        bookingId: booking._id.toString(),
        firstServiceDateTime:
          createManualBookingDto.services[0]?.dateAndTime || '',
        totalServices: createManualBookingDto.services.length,
      });
    } catch (error) {
      this.customLogger.warn(
        `Failed to send booking confirmation email: ${error}`,
        BookingService.name,
      );
    }

    return {
      _id: booking._id,
      userId: booking.userId,
      businessId: booking.businessId,
      services: booking.services,
      bookingStatus: booking.bookingStatus,
      notes: booking.notes,
      confirmedAt: booking.confirmedAt,
      createdAt: new Date(booking._id.getTimestamp()),
    };
  }
}
