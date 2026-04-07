import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { EmailJob } from './email.queue';
import { EmailService } from '../../services/email.service';
import { EmailHistory } from '../../../database/schemas';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
    @InjectModel(EmailHistory.name)
    private readonly emailHistoryModel: Model<EmailHistory>,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<EmailJob>): Promise<void> {
    this.logger.info(`Processing email job: ${job.name} (ID: ${job.id})`, {
      context: 'EmailProcessor',
      jobId: job.id,
      jobName: job.name,
    });

    try {
      switch (job.data.type) {
        case 'verification':
          await this.handleVerificationEmail(job);
          break;
        case 'welcome':
          await this.handleWelcomeEmail(job);
          break;
        case 'password_reset':
          await this.handlePasswordResetEmail(job);
          break;
        case 'admin_contact':
          await this.handleAdminContactEmail(job);
          break;
        default:
          this.logger.warn(
            `Unknown email job type: ${String((job.data as { type?: string }).type || 'undefined')}`,
            { context: 'EmailProcessor', jobId: job.id },
          );
      }
    } catch (error) {
      this.logger.error(`Failed to process email job ${job.id}`, {
        context: 'EmailProcessor',
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error; // Re-throw to trigger retry
    }
  }

  private async handleVerificationEmail(job: Job<EmailJob>): Promise<void> {
    const data = job.data as Extract<EmailJob, { type: 'verification' }>;
    const { email, username, verificationCode, authId } = data;

    try {
      // Send the email
      await this.emailService.sendVerificationEmail(
        email,
        username,
        verificationCode,
      );

      // Update email history status to 'sent'
      await this.emailHistoryModel.updateMany(
        {
          authId,
          emailType: 'verification',
          emailStatus: 'pending',
        },
        {
          emailStatus: 'sent',
        },
      );

      this.logger.info(`Verification email sent successfully to ${email}`, {
        context: 'EmailProcessor',
        jobId: job.id,
        email,
      });
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}`, {
        context: 'EmailProcessor',
        email,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Update email history status to 'failed'
      await this.emailHistoryModel.updateMany(
        {
          authId,
          emailType: 'verification',
          emailStatus: 'pending',
        },
        {
          emailStatus: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'Failed to send email',
        },
      );

      throw error; // Re-throw to trigger retry
    }
  }

  private async handleWelcomeEmail(job: Job<EmailJob>): Promise<void> {
    const data = job.data as Extract<EmailJob, { type: 'welcome' }>;
    const { email, username } = data;

    try {
      await this.emailService.sendWelcomeEmail(email, username);
      this.logger.info(`Welcome email sent successfully to ${email}`, {
        context: 'EmailProcessor',
        jobId: job.id,
        email,
      });
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}`, {
        context: 'EmailProcessor',
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw for welcome emails - they're non-critical
      // Just log the error and mark job as complete
    }
  }

  private async handlePasswordResetEmail(job: Job<EmailJob>): Promise<void> {
    const data = job.data as Extract<EmailJob, { type: 'password_reset' }>;
    const { email, username, resetCode, authId } = data;

    try {
      // Send the email
      await this.emailService.sendPasswordResetEmail(
        email,
        username,
        resetCode,
      );

      // Update email history status to 'sent'
      await this.emailHistoryModel.updateMany(
        {
          authId,
          emailType: 'password_reset',
          emailStatus: 'pending',
        },
        {
          emailStatus: 'sent',
        },
      );

      this.logger.info(`Password reset email sent successfully to ${email}`, {
        context: 'EmailProcessor',
        jobId: job.id,
        email,
      });
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}`, {
        context: 'EmailProcessor',
        email,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Update email history status to 'failed'
      await this.emailHistoryModel.updateMany(
        {
          authId,
          emailType: 'password_reset',
          emailStatus: 'pending',
        },
        {
          emailStatus: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'Failed to send email',
        },
      );

      throw error; // Re-throw to trigger retry
    }
  }

  private async handleAdminContactEmail(job: Job<EmailJob>): Promise<void> {
    const data = job.data as Extract<EmailJob, { type: 'admin_contact' }>;
    const { fullName, userEmail, message } = data;

    try {
      await this.emailService.sendAdminContactEmail(
        fullName,
        userEmail,
        message,
      );
      this.logger.info(
        `Admin contact email sent successfully for ${userEmail}`,
        {
          context: 'EmailProcessor',
          jobId: job.id,
          userEmail,
        },
      );
    } catch (error) {
      this.logger.error(`Failed to send admin contact email for ${userEmail}`, {
        context: 'EmailProcessor',
        userEmail,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
