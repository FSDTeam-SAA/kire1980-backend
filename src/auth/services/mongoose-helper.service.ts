import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import {
  AuthUser,
  AuthSecurity,
  UserProfile,
  LoginHistory,
  EmailHistory,
} from '../../database/schemas';

@Injectable()
export class MongooseHelper {
  constructor(
    @InjectModel(AuthUser.name) private authUserModel: Model<AuthUser>,
    @InjectModel(AuthSecurity.name)
    private authSecurityModel: Model<AuthSecurity>,
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfile>,
    @InjectModel(LoginHistory.name)
    private loginHistoryModel: Model<LoginHistory>,
    @InjectModel(EmailHistory.name)
    private emailHistoryModel: Model<EmailHistory>,
  ) {}

  /**
   * Find user by email or username
   */
  async findUserByEmailOrUsername(email?: string, username?: string) {
    return this.authUserModel.findOne({
      $or: [{ email }, { username }],
    });
  }

  /**
   * Find user by ID with optional relations
   */
  async findUserById(id: string, populate = false) {
    let query = this.authUserModel.findById(id);
    if (populate) {
      query = query
        .populate('userProfile')
        .populate('authSecurity')
        .populate('loginHistory')
        .populate('emailHistory');
    }
    return query.exec();
  }

  /**
   * Create new user with transaction
   */
  async createUserWithSecurityAndProfile(
    email: string,
    username: string,
    hashedPassword: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const session = await (this.authUserModel.db as any).startSession();
    session.startTransaction();

    try {
      // Create auth user
      const user = await this.authUserModel.create(
        [
          {
            email,
            username,
            password: hashedPassword,
            role: 'USER',
            verified: false,
            status: 'ACTIVE',
            provider: 'local',
          },
        ],
        { session },
      );

      const userId = user[0]._id;

      // Create auth security
      await this.authSecurityModel.create(
        [
          {
            authId: userId,
            failedAttempts: 0,
            mfaEnabled: false,
            mfaMethod: 'totp',
          },
        ],
        { session },
      );

      // Create user profile
      await this.userProfileModel.create(
        [
          {
            authId: userId,
          },
        ],
        { session },
      );

      // Update user with profile reference
      await this.authUserModel.findByIdAndUpdate(
        userId,
        { userProfile: user[0].userProfile },
        { session },
      );

      await session.commitTransaction();
      return user[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Record login attempt
   */
  async recordLoginAttempt(
    userId: string,
    success: boolean,
    ipAddress: string,
    userAgent: string,
    failureReason?: string,
    deviceId?: string,
  ) {
    return this.loginHistoryModel.create({
      authId: userId,
      ipAddress,
      userAgent,
      deviceId,
      action: 'login',
      success,
      failureReason,
      isSuspicious: false,
    });
  }

  /**
   * Create email history record
   */
  async createEmailHistory(
    userId: string,
    emailTo: string,
    emailType: string,
    emailProvider = 'smtp',
  ) {
    return this.emailHistoryModel.create({
      authId: userId,
      emailTo,
      emailType,
      emailProvider,
      emailStatus: 'pending',
      retryCount: 0,
    });
  }

  /**
   * Update email history status
   */
  async updateEmailHistoryStatus(
    emailHistoryId: string,
    status: string,
    sentAt?: Date,
    errorMessage?: string,
  ) {
    return this.emailHistoryModel.findByIdAndUpdate(
      emailHistoryId,
      {
        emailStatus: status,
        sentAt: sentAt || new Date(),
        errorMessage,
      },
      { new: true },
    );
  }

  /**
   * Get recent login history
   */
  async getLoginHistory(userId: string, limit = 10) {
    return this.loginHistoryModel
      .find({ authId: userId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Update user password and token version
   */
  async updateUserPasswordAndTokenVersion(
    userId: string,
    hashedPassword: string,
  ) {
    return this.authUserModel.findByIdAndUpdate(
      userId,
      {
        password: hashedPassword,
        tokenVersion: { $inc: 1 },
      },
      { new: true },
    );
  }

  /**
   * Update auth security - failed attempts
   */
  async updateFailedAttempts(userId: string, attempts: number) {
    return this.authSecurityModel.findOneAndUpdate(
      { authId: userId },
      {
        failedAttempts: attempts,
        lastFailedAt: new Date(),
      },
      { new: true },
    );
  }

  /**
   * Reset failed attempts
   */
  async resetFailedAttempts(userId: string) {
    return this.authSecurityModel.findOneAndUpdate(
      { authId: userId },
      {
        failedAttempts: 0,
        lastFailedAt: null,
      },
      { new: true },
    );
  }
}
