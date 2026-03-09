import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CustomLoggerService } from '../common/services/custom-logger.service';
import { AuthUser } from '../database/schemas';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(AuthUser.name) private readonly userModel: Model<AuthUser>,
    private readonly customLogger: CustomLoggerService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    this.customLogger.log('Creating new user', 'UserService');

    // Check if user with email already exists
    const existingUser = await this.userModel.findOne({
      email: createUserDto.email,
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user
    const user = await this.userModel.create({
      ...createUserDto,
      password: hashedPassword,
      role: createUserDto.role || 'customer',
      verified: false,
    });

    // Return user without password
    const userObject = user.toObject();
    delete userObject.password;

    return userObject;
  }

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

  async update(id: string, updateUserDto: UpdateUserDto) {
    this.customLogger.log(`Updating user with id: ${id}`, 'UserService');

    // If password is being updated, hash it
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { ...updateUserDto, updatedAt: new Date() },
        { new: true },
      )
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async remove(id: string) {
    this.customLogger.warn(`Removing user with id: ${id}`, 'UserService');
    const user = await this.userModel.findByIdAndDelete(id).exec();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return { message: 'User deleted successfully', id };
  }
}
