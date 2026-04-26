import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { SmsService } from '../../services/sms.service';
import { SmsJob } from './sms.queue';

@Processor('sms')
export class SmsProcessor extends WorkerHost {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
    private readonly smsService: SmsService,
  ) {
    super();
  }

  async process(job: Job<SmsJob>): Promise<void> {
    this.logger.info(`Processing sms job: ${job.name} (ID: ${job.id})`, {
      context: 'SmsProcessor',
      jobId: job.id,
      jobName: job.name,
    });

    try {
      switch (job.data.type) {
        case 'booking_created':
          await this.handleBookingCreatedSms(job);
          break;
        default:
          this.logger.warn(
            `Unknown sms job type: ${String((job.data as { type?: string }).type || 'undefined')}`,
            { context: 'SmsProcessor', jobId: job.id },
          );
      }
    } catch (error) {
      this.logger.error(`Failed to process sms job ${job.id}`, {
        context: 'SmsProcessor',
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private async handleBookingCreatedSms(job: Job<SmsJob>): Promise<void> {
    const data = job.data;

    try {
      await this.smsService.sendBookingCreatedSms(
        data.toPhoneNumber,
        data.recipientType,
        data.bookingId,
        data.businessName,
        data.firstServiceDateTime,
      );

      this.logger.info(
        `Booking created sms sent to ${data.recipientType}: ${data.toPhoneNumber}`,
        {
          context: 'SmsProcessor',
          jobId: job.id,
          recipientType: data.recipientType,
          toPhoneNumber: data.toPhoneNumber,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to send booking created sms to ${data.recipientType}: ${data.toPhoneNumber}`,
        {
          context: 'SmsProcessor',
          jobId: job.id,
          recipientType: data.recipientType,
          toPhoneNumber: data.toPhoneNumber,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }
  }
}
