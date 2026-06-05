import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

export interface VerificationEmailJob {
  type: 'verification';
  email: string;
  username: string;
  verificationCode: string;
  authId: string;
}

export interface WelcomeEmailJob {
  type: 'welcome';
  email: string;
  username: string;
  authId?: string;
}

export interface PasswordResetEmailJob {
  type: 'password_reset';
  email: string;
  username: string;
  resetCode: string;
  authId: string;
}

export interface AdminContactEmailJob {
  type: 'admin_contact';
  fullName: string;
  userEmail: string;
  message: string;
}

export interface BookingCreatedEmailJob {
  type: 'booking_created';
  recipientType: 'customer' | 'business' | 'staff';
  recipientEmail: string;
  recipientName: string;
  customerName: string;
  businessName: string;
  bookingId: string;
  firstServiceDateTime: string;
  totalServices: number;
  serviceName?: string;
  staffName?: string;
  dateTime?: string;
}

export type EmailJob =
  | VerificationEmailJob
  | WelcomeEmailJob
  | PasswordResetEmailJob
  | AdminContactEmailJob
  | BookingCreatedEmailJob;

@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  async sendVerificationEmail(
    email: string,
    username: string,
    verificationCode: string,
    authId: string,
  ): Promise<void> {
    await this.emailQueue.add(
      'send-verification',
      {
        type: 'verification',
        email,
        username,
        verificationCode,
        authId,
      } as VerificationEmailJob,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }

  async sendWelcomeEmail(
    email: string,
    username: string,
    authId?: string,
  ): Promise<void> {
    await this.emailQueue.add(
      'send-welcome',
      {
        type: 'welcome',
        email,
        username,
        authId,
      } as WelcomeEmailJob,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }

  async sendPasswordResetEmail(
    email: string,
    username: string,
    resetCode: string,
    authId: string,
  ): Promise<void> {
    await this.emailQueue.add(
      'send-password-reset',
      {
        type: 'password_reset',
        email,
        username,
        resetCode,
        authId,
      } as PasswordResetEmailJob,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }

  async sendAdminContactEmail(
    fullName: string,
    userEmail: string,
    message: string,
  ): Promise<void> {
    await this.emailQueue.add(
      'send-admin-contact',
      {
        type: 'admin_contact',
        fullName,
        userEmail,
        message,
      } as AdminContactEmailJob,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }

  async sendBookingCreatedNotificationEmails(payload: {
    customerEmail: string;
    customerName: string;
    businessEmail?: string;
    businessEmails?: string[];
    businessName: string;
    bookingId: string;
    firstServiceDateTime: string;
    totalServices: number;
    staffRecipients?: Array<{
      staffEmail: string;
      staffName: string;
      serviceName: string;
      dateTime: string;
    }>;
  }): Promise<void> {
    const {
      customerEmail,
      customerName,
      businessEmail,
      businessEmails,
      businessName,
      bookingId,
      firstServiceDateTime,
      totalServices,
      staffRecipients,
    } = payload;

    const baseJobOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    };

    const uniqueBusinessEmails = Array.from(
      new Set([businessEmail, ...(businessEmails || [])].filter(Boolean)),
    );

    const bookingCreatedJobs = [
      this.emailQueue.add(
        'send-booking-created-customer',
        {
          type: 'booking_created',
          recipientType: 'customer',
          recipientEmail: customerEmail,
          recipientName: customerName,
          customerName,
          businessName,
          bookingId,
          firstServiceDateTime,
          totalServices,
        } as BookingCreatedEmailJob,
        baseJobOptions,
      ),
      ...uniqueBusinessEmails.map((recipientEmail) =>
        this.emailQueue.add(
          'send-booking-created-business',
          {
            type: 'booking_created',
            recipientType: 'business',
            recipientEmail,
            recipientName: businessName,
            customerName,
            businessName,
            bookingId,
            firstServiceDateTime,
            totalServices,
          } as BookingCreatedEmailJob,
          baseJobOptions,
        ),
      ),
      ...(staffRecipients || []).map((recipient) =>
        this.emailQueue.add(
          'send-booking-created-staff',
          {
            type: 'booking_created',
            recipientType: 'staff',
            recipientEmail: recipient.staffEmail,
            recipientName: recipient.staffName,
            customerName,
            businessName,
            bookingId,
            firstServiceDateTime: recipient.dateTime,
            totalServices,
            serviceName: recipient.serviceName,
            staffName: recipient.staffName,
            dateTime: recipient.dateTime,
          } as BookingCreatedEmailJob,
          baseJobOptions,
        ),
      ),
    ];

    await Promise.all(bookingCreatedJobs);
  }
}
