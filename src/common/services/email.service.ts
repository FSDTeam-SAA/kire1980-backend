import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import config from '../config/app.config';
import AppError from '../errors/app.error';
import httpStatus from 'http-status';
import { CustomLoggerService } from './custom-logger.service';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailTestResult {
  verified: boolean;
  messageId: string;
  recipient: string;
}

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly customLogger: CustomLoggerService) {
    this.transporter = nodemailer.createTransport({
      host: String(config.email_host),
      port: Number(config.email_port),
      secure: config.email_port === 465, // true for 465, false for other ports
      auth: {
        user: String(config.email_user),
        pass: String(config.email_pass),
      },
    });
  }

  /**
   * Send an email
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    this.customLogger.log(
      `Sending email to: ${options.to}, subject: ${options.subject}`,
      'EmailService',
    );
    const mailOptions = {
      from: String(config.email_from || config.email_user),
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.customLogger.log(
        `Email sent successfully to: ${options.to}`,
        'EmailService',
      );
    } catch (error) {
      this.customLogger.error(
        `Error sending email to ${options.to}`,
        error instanceof Error ? error.stack : undefined,
        'EmailService',
      );
      console.error('Error sending email:', error);
      throw AppError.badRequest('Email sending failed, something went wrong!');
    }
  }

  async sendTestEmail(recipientEmail: string): Promise<EmailTestResult> {
    try {
      this.customLogger.log(
        `Verifying email credentials for: ${recipientEmail}`,
        'EmailService',
      );

      await this.transporter.verify();

      const mailOptions = {
        from: String(config.email_from || config.email_user),
        to: recipientEmail,
        subject: 'Email credential test',
        text: 'This is a test email to verify the SMTP credentials are working.',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Email Credential Test</h2>
            <p>This message confirms that the SMTP credentials are working.</p>
            <p><strong>Recipient:</strong> ${recipientEmail}</p>
            <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
          </div>
        `,
      };

      const result = await this.transporter.sendMail(mailOptions);

      this.customLogger.log(
        `Test email sent successfully to: ${recipientEmail}`,
        'EmailService',
      );

      return {
        verified: true,
        messageId: result.messageId,
        recipient: recipientEmail,
      };
    } catch (error) {
      this.customLogger.error(
        `Email credential test failed for ${recipientEmail}`,
        error instanceof Error ? error.stack : undefined,
        'EmailService',
      );
      console.error('Error testing email credentials:', error);
      throw AppError.badRequest(
        'Email credential test failed, check your SMTP settings.',
      );
    }
  }

  /**
   * Load and parse email template
   */
  getEmailTemplate(
    filePath: string,
    replacements: Record<string, string>,
  ): string {
    try {
      const absolutePath = path.resolve(
        process.cwd(),
        'templates',
        'emails',
        filePath,
      );
      let template = fs.readFileSync(absolutePath, { encoding: 'utf-8' });

      for (const key in replacements) {
        template = template.replace(
          new RegExp(`{{${key}}}`, 'g'),
          replacements[key],
        );
      }

      return template;
    } catch (error) {
      console.error('Error reading email template:', error);
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Email template loading failed.',
      );
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(
    email: string,
    username: string,
    verificationCode: string,
  ): Promise<void> {
    const html = this.getEmailTemplate('verification.html', {
      username,
      verificationCode,
      year: new Date().getFullYear().toString(),
    });

    await this.sendEmail({
      to: email,
      subject: 'Verify your email address',
      html,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    username: string,
    resetCode: string,
  ): Promise<void> {
    const html = this.getEmailTemplate('password-reset.html', {
      username,
      resetCode,
      year: new Date().getFullYear().toString(),
    });

    await this.sendEmail({
      to: email,
      subject: 'Reset your password',
      html,
    });
  }

  /**
   * Send welcome email after verification
   */
  async sendWelcomeEmail(email: string, username: string): Promise<void> {
    const html = this.getEmailTemplate('welcome.html', {
      username,
      year: new Date().getFullYear().toString(),
    });

    await this.sendEmail({
      to: email,
      subject: 'Welcome to our platform!',
      html,
    });
  }

  /**
   * Send admin contact email notification
   */
  async sendAdminContactEmail(
    fullName: string,
    userEmail: string,
    message: string,
  ): Promise<void> {
    const html = this.getEmailTemplate('admin-contact.html', {
      fullName,
      userEmail,
      message,
      year: new Date().getFullYear().toString(),
    });

    await this.sendEmail({
      to: String(config.email_from || config.email_user),
      subject: `New Contact Inquiry from ${fullName}`,
      html,
    });
  }

  async sendBookingCreatedCustomerEmail(
    email: string,
    customerName: string,
    businessName: string,
    bookingId: string,
    firstServiceDateTime: string,
    totalServices: number,
  ): Promise<void> {
    const viewUrl = String(config.app_url || config.frontend_url || '#');
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>Booking Confirmed</h2>
        <p>Hello ${customerName},</p>
        <p>Your appointment with ${businessName} has been successfully confirmed.</p>

        <h3>Booking Details</h3>
        <table style="border-collapse: collapse;">
          <tr><td style="padding:4px 8px;font-weight:600;">Booking ID</td><td style="padding:4px 8px;">${bookingId}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Service</td><td style="padding:4px 8px;">${totalServices > 1 ? totalServices + ' services' : '1 service'}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Date</td><td style="padding:4px 8px;">${firstServiceDateTime.split('T')[0] || firstServiceDateTime}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Time</td><td style="padding:4px 8px;">${new Date(firstServiceDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || firstServiceDateTime}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Status</td><td style="padding:4px 8px;">Confirmed</td></tr>
        </table>

        <h3>Business Information</h3>
        <p>${businessName}</p>

        <p>If you need assistance, please contact the business directly.</p>

        <p style="margin:18px 0;"><a href="${viewUrl}/bookings/${bookingId}" style="background:#1766d9;color:#fff;padding:10px 14px;border-radius:4px;text-decoration:none;">View Booking</a></p>

        <p style="color:#666;font-size:13px;">Thank you for choosing Bookerst,</p>
        <p style="color:#666;font-size:13px;">We look forward to serving you<br/>Best regards,<br/>The Bookers Team<br/><a href="${viewUrl}" style="color:#1766d9;">${viewUrl.replace(/^https?:\/\//, '')}</a><br/>© ${new Date().getFullYear()} Bookersi. All rights reserved</p>
      </div>
    `;

    await this.sendEmail({
      to: email,
      subject: `Booking Confirmed with ${businessName}`,
      html,
    });
  }

  async sendBookingCreatedBusinessEmail(
    email: string,
    businessName: string,
    customerName: string,
    bookingId: string,
    firstServiceDateTime: string,
    totalServices: number,
  ): Promise<void> {
    const viewUrl = String(config.app_url || config.frontend_url || '#');
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>New Booking Received</h2>
        <p>Hello ${businessName},</p>
        <p>You have received a new booking.</p>

        <h3>Booking Details</h3>
        <table style="border-collapse: collapse;">
          <tr><td style="padding:4px 8px;font-weight:600;">Booking ID</td><td style="padding:4px 8px;">${bookingId}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Customer</td><td style="padding:4px 8px;">${customerName}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Service</td><td style="padding:4px 8px;">${totalServices > 1 ? totalServices + ' services' : '1 service'}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Date</td><td style="padding:4px 8px;">${firstServiceDateTime.split('T')[0] || firstServiceDateTime}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Time</td><td style="padding:4px 8px;">${new Date(firstServiceDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || firstServiceDateTime}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Status</td><td style="padding:4px 8px;">Confirmed</td></tr>
        </table>

        <p style="margin:18px 0;"><a href="${viewUrl}/business/bookings/${bookingId}" style="background:#1766d9;color:#fff;padding:10px 14px;border-radius:4px;text-decoration:none;">View Booking</a></p>

        <p style="color:#666;font-size:13px;">If you need assistance, please contact the business directly.</p>

        <p style="color:#666;font-size:13px;">Best regards,<br/>The Bookers Team<br/>© ${new Date().getFullYear()} Bookersi. All rights reserved</p>
      </div>
    `;

    await this.sendEmail({
      to: email,
      subject: `New Booking Received (#${bookingId})`,
      html,
    });
  }

  /**
   * Notify an assigned staff member about a new booking
   */
  async sendBookingCreatedStaffEmail(
    staffEmail: string,
    staffName: string,
    businessName: string,
    bookingId: string,
    serviceName: string,
    dateTime: string,
  ): Promise<void> {
    const viewUrl = String(config.app_url || config.frontend_url || '#');
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>New Booking Assigned</h2>
        <p>Hello ${staffName},</p>
        <p>A new booking has been assigned to you at ${businessName}.</p>

        <h3>Booking Details</h3>
        <table style="border-collapse: collapse;">
          <tr><td style="padding:4px 8px;font-weight:600;">Booking ID</td><td style="padding:4px 8px;">${bookingId}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Service</td><td style="padding:4px 8px;">${serviceName}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Date & Time</td><td style="padding:4px 8px;">${dateTime}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Status</td><td style="padding:4px 8px;">Confirmed</td></tr>
        </table>

        <p style="margin:18px 0;"><a href="${viewUrl}/staff/bookings/${bookingId}" style="background:#1766d9;color:#fff;padding:10px 14px;border-radius:4px;text-decoration:none;">View Booking</a></p>

        <p style="color:#666;font-size:13px;">If you need assistance, please contact the business directly.</p>

        <p style="color:#666;font-size:13px;">Best regards,<br/>The Bookers Team<br/>© ${new Date().getFullYear()} Bookersi. All rights reserved</p>
      </div>
    `;

    await this.sendEmail({
      to: staffEmail,
      subject: `New Booking Assigned (#${bookingId})`,
      html,
    });
  }
}
