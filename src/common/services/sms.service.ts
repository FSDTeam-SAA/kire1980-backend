import { Injectable } from '@nestjs/common';
import twilio, { Twilio } from 'twilio';
import config from '../config/app.config';
import { CustomLoggerService } from './custom-logger.service';

@Injectable()
export class SmsService {
  private readonly twilioClient: Twilio | null;

  constructor(private readonly customLogger: CustomLoggerService) {
    if (!config.twilio_account_sid || !config.twilio_auth_token) {
      this.customLogger.warn(
        'Twilio credentials are missing. SMS sending is disabled.',
        'SmsService',
      );
      this.twilioClient = null;
      return;
    }

    this.twilioClient = twilio(
      config.twilio_account_sid,
      config.twilio_auth_token,
    );
  }

  async sendSms(to: string, body: string): Promise<void> {
    if (!this.twilioClient) {
      throw new Error('Twilio is not configured');
    }

    if (!config.twilio_phone_number) {
      throw new Error('TWILIO_PHONE_NUMBER is not configured');
    }

    await this.twilioClient.messages.create({
      to,
      from: config.twilio_phone_number,
      body,
    });
  }

  async sendBookingCreatedSms(
    to: string,
    recipientType: 'customer' | 'business',
    bookingId: string,
    businessName: string,
    firstServiceDateTime: string,
  ): Promise<void> {
    const body =
      recipientType === 'customer'
        ? `Booking confirmed (#${bookingId}) at ${businessName}. First service: ${firstServiceDateTime}.`
        : `New booking (#${bookingId}) for ${businessName}. First service: ${firstServiceDateTime}.`;

    await this.sendSms(to, body);

    this.customLogger.log(
      `Booking created SMS sent to ${recipientType}: ${to}`,
      'SmsService',
    );
  }
}
