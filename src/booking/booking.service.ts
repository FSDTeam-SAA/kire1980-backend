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

    // Verify service exists and belongs to the business
    const service = await this.serviceModel.findById(
      createBookingDto.serviceId,
    );
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (service.businessId.toString() !== createBookingDto.businessId) {
      throw new BadRequestException(
        'Service does not belong to the specified business',
      );
    }

    // Verify staff member exists and is assigned to the service
    const staffMember = await this.staffModel.findOne({
      _id: createBookingDto.selectedProvider,
      businessId: new Types.ObjectId(createBookingDto.businessId),
      isDeleted: false,
      isActive: true,
    });

    if (!staffMember) {
      throw new NotFoundException('Staff member not found or is not active');
    }

    if (
      !staffMember.serviceIds.some(
        (id) => id.toString() === createBookingDto.serviceId,
      )
    ) {
      throw new BadRequestException(
        'Selected provider is not assigned to this service',
      );
    }

    // Check for time slot conflicts
    const conflictingBooking = await this.bookingModel.findOne({
      selectedProvider: new Types.ObjectId(createBookingDto.selectedProvider),
      dateAndTime: createBookingDto.dateAndTime,
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
        'This time slot is already booked with the selected provider',
      );
    }

    // Create booking
    const booking = await this.bookingModel.create({
      userId: new Types.ObjectId(userId),
      serviceId: new Types.ObjectId(createBookingDto.serviceId),
      businessId: new Types.ObjectId(createBookingDto.businessId),
      dateAndTime: createBookingDto.dateAndTime,
      selectedProvider: new Types.ObjectId(createBookingDto.selectedProvider),
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
        .populate('serviceId', 'serviceName price serviceDuration')
        .populate('businessId', 'businessName businessEmail phoneNumber')
        .populate('selectedProvider', 'firstName lastName email')
        .sort({ dateAndTime: -1 })
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
      .populate('serviceId', 'serviceName price serviceDuration description')
      .populate('businessId', 'businessName businessEmail phoneNumber address')
      .populate(
        'selectedProvider',
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
        .populate('serviceId', 'serviceName price serviceDuration')
        .populate('businessId', 'businessName')
        .populate('selectedProvider', 'firstName lastName')
        .sort({ dateAndTime: -1 })
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
        .populate('serviceId', 'serviceName price')
        .populate('selectedProvider', 'firstName lastName')
        .sort({ dateAndTime: -1 })
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

    // Check for time slot conflicts if dateAndTime or provider is being changed
    if (updateBookingDto.dateAndTime || updateBookingDto.selectedProvider) {
      const conflictingBooking = await this.bookingModel.findOne({
        _id: { $ne: id },
        selectedProvider: updateBookingDto.selectedProvider
          ? new Types.ObjectId(updateBookingDto.selectedProvider)
          : booking.selectedProvider,
        dateAndTime: updateBookingDto.dateAndTime || booking.dateAndTime,
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
          'This time slot is already booked with the selected provider',
        );
      }
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
