import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { BookingService } from './booking.service';
import { BookingStatus } from '../database/schemas/booking.schema';
import { CustomLoggerService } from '../common/services/custom-logger.service';
import { StaffService } from '../staff/staff.service';
import { EmailQueueService } from '../common/queues/email/email.queue';
import { SmsQueueService } from '../common/queues/sms/sms.queue';

describe('BookingService', () => {
  let service: BookingService;

  const mockBookingModel = {
    create: jest.fn(),
    findOne: jest.fn(),
  };

  const mockBusinessModel = {
    findById: jest.fn(),
  };

  const mockServiceModel = {
    findById: jest.fn(),
  };

  const mockStaffModel = {
    findOne: jest.fn(),
  };

  const mockAuthUserModel = {
    findById: jest.fn(),
  };

  const mockCustomLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  const mockStaffService = {
    isStaffScheduledForTime: jest.fn(),
  };

  const mockEmailQueueService = {
    sendBookingCreatedNotificationEmails: jest.fn(),
  };

  const mockSmsQueueService = {
    sendBookingCreatedNotificationSms: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        {
          provide: 'BookingModel',
          useValue: mockBookingModel,
        },
        {
          provide: 'BusinessInfoModel',
          useValue: mockBusinessModel,
        },
        {
          provide: 'ServiceModel',
          useValue: mockServiceModel,
        },
        {
          provide: 'StaffMemberModel',
          useValue: mockStaffModel,
        },
        {
          provide: 'AuthUserModel',
          useValue: mockAuthUserModel,
        },
        {
          provide: CustomLoggerService,
          useValue: mockCustomLoggerService,
        },
        {
          provide: StaffService,
          useValue: mockStaffService,
        },
        {
          provide: EmailQueueService,
          useValue: mockEmailQueueService,
        },
        {
          provide: SmsQueueService,
          useValue: mockSmsQueueService,
        },
      ],
    })
      .overrideProvider('BookingModel')
      .useValue(mockBookingModel)
      .compile();

    service = module.get<BookingService>(BookingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('queues customer and business owner notifications when a booking is created', async () => {
    const userId = '64b000000000000000000001';
    const businessId = '64b000000000000000000002';
    const serviceId = '64b000000000000000000003';
    const providerId = '64b000000000000000000004';
    const ownerId = '64b000000000000000000005';
    const bookingId = new Types.ObjectId('64b000000000000000000006');

    const createBookingDto = {
      businessId,
      notes: 'Please call before arrival',
      services: [
        {
          serviceId,
          selectedProvider: providerId,
          dateAndTime: new Date('2026-05-06T10:00:00.000Z'),
        },
      ],
    };

    mockAuthUserModel.findById.mockImplementation(async (id: string) => {
      const normalizedId = String(id);

      if (normalizedId === userId) {
        return {
          _id: new Types.ObjectId(userId),
          fullName: 'Customer User',
          email: 'customer@example.com',
          phoneNumber: '+15550000001',
        };
      }

      if (normalizedId === ownerId) {
        return {
          _id: new Types.ObjectId(ownerId),
          fullName: 'Business Owner',
          email: 'owner@example.com',
          phoneNumber: '+15550000002',
        };
      }

      return null;
    });

    mockBusinessModel.findById.mockResolvedValue({
      _id: new Types.ObjectId(businessId),
      businessName: 'Owner Business',
      businessEmail: 'business@example.com',
      phoneNumber: '+15550000999',
      ownerId: new Types.ObjectId(ownerId),
    });

    mockServiceModel.findById.mockResolvedValue({
      _id: new Types.ObjectId(serviceId),
      businessId: new Types.ObjectId(businessId),
    });

    mockStaffModel.findOne.mockResolvedValue({
      _id: new Types.ObjectId(providerId),
      firstName: 'Provider',
      serviceIds: [new Types.ObjectId(serviceId)],
      schedule: [],
    });

    mockStaffService.isStaffScheduledForTime.mockReturnValue(true);
    mockBookingModel.findOne.mockResolvedValue(null);
    mockBookingModel.create.mockResolvedValue({
      _id: bookingId,
      bookingStatus: BookingStatus.PENDING,
    });
    mockEmailQueueService.sendBookingCreatedNotificationEmails.mockResolvedValue(
      undefined,
    );
    mockSmsQueueService.sendBookingCreatedNotificationSms.mockResolvedValue(
      undefined,
    );

    const result = await service.create(userId, createBookingDto as any);

    expect(result).toEqual({
      _id: bookingId,
      bookingStatus: BookingStatus.PENDING,
    });
    expect(
      mockEmailQueueService.sendBookingCreatedNotificationEmails,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        customerEmail: 'customer@example.com',
        customerName: 'Customer User',
        businessEmail: 'owner@example.com',
        businessName: 'Owner Business',
        bookingId: bookingId.toString(),
        totalServices: 1,
      }),
    );
    expect(
      mockSmsQueueService.sendBookingCreatedNotificationSms,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        customerPhoneNumber: '+15550000001',
        customerName: 'Customer User',
        businessPhoneNumber: '+15550000002',
        businessName: 'Owner Business',
        bookingId: bookingId.toString(),
      }),
    );
  });
});
