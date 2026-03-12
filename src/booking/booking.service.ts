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
      `Booking ${booking._id} created by user ${userId}`,
      BookingService.name,
    );

    return booking;
  }

  async findAll(
    page = 1,
    limit = 10,
    userId?: string,
    businessId?: string,
    status?: BookingStatus,
  ) {
    const filter: any = { isDeleted: false };

    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    }

    if (businessId) {
      filter.businessId = new Types.ObjectId(businessId);
    }

    if (status) {
      filter.bookingStatus = status;
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
}
