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

export type EmailJob =
  | VerificationEmailJob
  | WelcomeEmailJob
  | PasswordResetEmailJob
  | AdminContactEmailJob;

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
}
