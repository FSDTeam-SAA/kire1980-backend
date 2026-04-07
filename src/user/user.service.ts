import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateUserDto } from './dto/update-user.dto';
import { CustomLoggerService } from '../common/services/custom-logger.service';
import { AuthUser } from '../database/schemas';
import { CloudinaryService } from '../common/services/cloudinary.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(AuthUser.name) private readonly userModel: Model<AuthUser>,
    private readonly customLogger: CustomLoggerService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async findAll() {
    this.customLogger.log('Fetching all users', 'UserService');
    const users = await this.userModel
      .find()
      .select('-password')
      .populate('businessId', 'name')
      .exec();
    return users;
  }

  async findOne(id: string) {
    this.customLogger.log(`Fetching user with id: ${id}`, 'UserService');
    const user = await this.userModel
      .findById(id)
      .select('-password')
      .populate('businessId', 'name')
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string) {
    return await this.userModel.findOne({ email }).exec();
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    avatarFile?: Express.Multer.File,
    actorRole?: string,
  ) {
    this.customLogger.log(`Updating user with id: ${id}`, 'UserService');

    const forbiddenFields: Array<keyof UpdateUserDto> = [
      'password',
      'businessId',
      'email',
    ];

    if (actorRole !== 'admin') {
      forbiddenFields.push('role', 'status');
    }

    const hasForbiddenField = forbiddenFields.some(
      (field) => updateUserDto[field] !== undefined,
    );
    if (hasForbiddenField) {
      throw new ForbiddenException(
        'You cannot update protected fields (like email, role, status, password, or businessId) from this endpoint without admin privileges.',
      );
    }

    if (avatarFile) {
      const uploadedAvatar = await this.cloudinaryService.uploadImage(
        avatarFile.buffer,
        'user-avatars',
      );
      updateUserDto.avatar = uploadedAvatar.url;
    }

    const safePayload = this.buildSafeProfileUpdatePayload(
      updateUserDto,
      actorRole,
    );

    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { ...safePayload, updatedAt: new Date() },
        { new: true },
      )
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  private buildSafeProfileUpdatePayload(
    updateUserDto: UpdateUserDto,
    actorRole?: string,
  ): Partial<AuthUser> {
    const allowedFields: Array<keyof UpdateUserDto> = [
      'fullName',
      'phoneNumber',
      'country',
      'city',
      'postalCode',
      'sector',
      'avatar',
    ];

    if (actorRole === 'admin') {
      allowedFields.push('status', 'role');
    }

    const safePayload: Partial<AuthUser> = {};

    for (const field of allowedFields) {
      const value = updateUserDto[field];

      if (value !== undefined) {
        (safePayload as Record<string, any>)[field] = value;
      }
    }

    return safePayload;
  }
}
