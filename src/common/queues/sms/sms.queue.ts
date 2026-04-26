import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

export interface BookingCreatedSmsJob {
  type: 'booking_created';
  recipientType: 'customer' | 'business';
  toPhoneNumber: string;
  recipientName: string;
  customerName: string;
  businessName: string;
  bookingId: string;
  firstServiceDateTime: string;
}

export type SmsJob = BookingCreatedSmsJob;

@Injectable()
export class SmsQueueService {
  constructor(@InjectQueue('sms') private smsQueue: Queue) {}

  async sendBookingCreatedNotificationSms(payload: {
    customerPhoneNumber?: string;
    customerName: string;
    businessPhoneNumber?: string;
    businessName: string;
    bookingId: string;
    firstServiceDateTime: string;
  }): Promise<void> {
    const {
      customerPhoneNumber,
      customerName,
      businessPhoneNumber,
      businessName,
      bookingId,
      firstServiceDateTime,
    } = payload;

    const jobOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    };

    const jobs: Promise<unknown>[] = [];

    if (customerPhoneNumber) {
      jobs.push(
        this.smsQueue.add(
          'send-booking-created-customer-sms',
          {
            type: 'booking_created',
            recipientType: 'customer',
            toPhoneNumber: customerPhoneNumber,
            recipientName: customerName,
            customerName,
            businessName,
            bookingId,
            firstServiceDateTime,
          } as BookingCreatedSmsJob,
          jobOptions,
        ),
      );
    }

    if (businessPhoneNumber) {
      jobs.push(
        this.smsQueue.add(
          'send-booking-created-business-sms',
          {
            type: 'booking_created',
            recipientType: 'business',
            toPhoneNumber: businessPhoneNumber,
            recipientName: businessName,
            customerName,
            businessName,
            bookingId,
            firstServiceDateTime,
          } as BookingCreatedSmsJob,
          jobOptions,
        ),
      );
    }

    if (jobs.length > 0) {
      await Promise.all(jobs);
    }
  }
}
