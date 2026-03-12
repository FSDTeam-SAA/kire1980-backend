import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  StaffMember,
  BusinessInfo,
  Service,
  AuthUser,
} from '../database/schemas';
import { CreateStaffMemberDto } from './dto/create-staff-member.dto';
import { UpdateStaffMemberDto } from './dto/update-staff-member.dto';
import { CustomLoggerService } from '../common/services/custom-logger.service';
import { CloudinaryService } from '../common/services/cloudinary.service';

@Injectable()
export class StaffService {
  constructor(
    @InjectModel(StaffMember.name)
    private readonly staffModel: Model<StaffMember>,
    @InjectModel(BusinessInfo.name)
    private readonly businessModel: Model<BusinessInfo>,
    @InjectModel(Service.name)
    private readonly serviceModel: Model<Service>,
    @InjectModel(AuthUser.name)
    private readonly authUserModel: Model<AuthUser>,
    private readonly customLogger: CustomLoggerService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(
    userId: string,
    createStaffMemberDto: CreateStaffMemberDto,
    file?: Express.Multer.File,
  ) {
    const businessIdAsObjectId = new Types.ObjectId(
      createStaffMemberDto.businessId,
    );
    const businessIdAsString = createStaffMemberDto.businessId;

    // Verify business exists
    const business = await this.businessModel.findById(
      createStaffMemberDto.businessId,
    );
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // Verify user owns the business
    if (business.ownerId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to add staff to this business',
      );
    }

    // Check if email already exists for this business
    const existingStaff = await this.staffModel.findOne({
      email: createStaffMemberDto.email,
      businessId: businessIdAsObjectId,
      isDeleted: false,
    });

    if (existingStaff) {
      throw new ConflictException(
        'A staff member with this email already exists for this business',
      );
    }

    // Verify all service IDs belong to the business
    if (createStaffMemberDto.serviceIds?.length) {
      const uniqueServiceIds = [...new Set(createStaffMemberDto.serviceIds)];
      const services = await this.serviceModel.find({
        _id: { $in: uniqueServiceIds },
        businessId: { $in: [businessIdAsObjectId, businessIdAsString] },
      });

      if (services.length !== uniqueServiceIds.length) {
        throw new BadRequestException(
          'One or more service IDs are invalid or do not belong to this business',
        );
      }
    }

    // Upload avatar if provided
    let avatarData;
    if (file) {
      const uploadResult = await this.cloudinaryService.uploadImage(
        file.buffer,
        'staff-avatars',
      );
      avatarData = {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        uploadedAt: new Date(),
      };
    }

    // Create staff member
    const staffMember = await this.staffModel.create({
      firstName: createStaffMemberDto.firstName,
      lastName: createStaffMemberDto.lastName,
      email: createStaffMemberDto.email,
      phoneNumber: createStaffMemberDto.phoneNumber,
      businessId: businessIdAsObjectId,
      serviceIds:
        createStaffMemberDto.serviceIds?.map((id) => new Types.ObjectId(id)) ||
        [],
      description: createStaffMemberDto.description,
      avatar: avatarData,
    });

    this.customLogger.log(
      `Staff member ${staffMember._id} created for business ${createStaffMemberDto.businessId}`,
      StaffService.name,
    );

    return staffMember;
  }

  async findAll(
    page = 1,
    limit = 10,
    businessId?: string,
    serviceId?: string,
    isActive?: boolean,
  ) {
    const filter: any = { isDeleted: false };

    if (businessId) {
      filter.businessId = new Types.ObjectId(businessId);
    }

    if (serviceId) {
      filter.serviceIds = new Types.ObjectId(serviceId);
    }

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    const skip = (page - 1) * limit;

    const [staffMembers, total] = await Promise.all([
      this.staffModel
        .find(filter)
        .populate('businessId', 'businessName')
        .populate('serviceIds', 'serviceName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.staffModel.countDocuments(filter),
    ]);

    return {
      data: staffMembers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid staff member ID');
    }

    const staffMember = await this.staffModel
      .findOne({ _id: id, isDeleted: false })
      .populate('businessId', 'businessName businessEmail phoneNumber')
      .populate('serviceIds', 'serviceName category price')
      .lean();

    if (!staffMember) {
      throw new NotFoundException('Staff member not found');
    }

    return staffMember;
  }

  async findByBusiness(businessId: string, page = 1, limit = 10) {
    if (!Types.ObjectId.isValid(businessId)) {
      throw new BadRequestException('Invalid business ID');
    }

    const skip = (page - 1) * limit;

    const [staffMembers, total] = await Promise.all([
      this.staffModel
        .find({
          businessId: new Types.ObjectId(businessId),
          isDeleted: false,
        })
        .populate('serviceIds', 'serviceName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.staffModel.countDocuments({
        businessId: new Types.ObjectId(businessId),
        isDeleted: false,
      }),
    ]);

    return {
      data: staffMembers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(
    id: string,
    userId: string,
    updateStaffMemberDto: UpdateStaffMemberDto,
    file?: Express.Multer.File,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid staff member ID');
    }

    const staffMember = await this.staffModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!staffMember) {
      throw new NotFoundException('Staff member not found');
    }

    // Verify user owns the business
    const business = await this.businessModel.findById(staffMember.businessId);
    if (!business || business.ownerId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to update this staff member',
      );
    }

    // Verify service IDs if being updated
    if (updateStaffMemberDto.serviceIds?.length) {
      const uniqueServiceIds = [...new Set(updateStaffMemberDto.serviceIds)];
      const services = await this.serviceModel.find({
        _id: { $in: uniqueServiceIds },
        businessId: {
          $in: [staffMember.businessId, staffMember.businessId.toString()],
        },
      });

      if (services.length !== uniqueServiceIds.length) {
        throw new BadRequestException(
          'One or more service IDs are invalid or do not belong to this business',
        );
      }

      updateStaffMemberDto.serviceIds = updateStaffMemberDto.serviceIds.map(
        (id) => new Types.ObjectId(id) as any,
      );
    }

    // Handle avatar update
    if (file) {
      // Delete old avatar if exists
      if (staffMember.avatar?.publicId) {
        await this.cloudinaryService.deleteImage(staffMember.avatar.publicId);
      }

      // Upload new avatar
      const uploadResult = await this.cloudinaryService.uploadImage(
        file.buffer,
        'staff-avatars',
      );

      (updateStaffMemberDto as any).avatar = {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        uploadedAt: new Date(),
      };
    }

    // Update staff member
    Object.assign(staffMember, updateStaffMemberDto);
    await staffMember.save();

    this.customLogger.log(
      `Staff member ${id} updated by user ${userId}`,
      StaffService.name,
    );

    return staffMember;
  }

  async remove(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid staff member ID');
    }

    const staffMember = await this.staffModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!staffMember) {
      throw new NotFoundException('Staff member not found');
    }

    // Verify user owns the business
    const business = await this.businessModel.findById(staffMember.businessId);
    if (!business || business.ownerId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to delete this staff member',
      );
    }

    // Soft delete
    staffMember.isDeleted = true;
    staffMember.isActive = false;
    await staffMember.save();

    // Optionally delete avatar from Cloudinary
    if (staffMember.avatar?.publicId) {
      await this.cloudinaryService.deleteImage(staffMember.avatar.publicId);
    }

    this.customLogger.log(
      `Staff member ${id} deleted by user ${userId}`,
      StaffService.name,
    );

    return { message: 'Staff member deleted successfully' };
  }

  async toggleActiveStatus(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid staff member ID');
    }

    const staffMember = await this.staffModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!staffMember) {
      throw new NotFoundException('Staff member not found');
    }

    // Verify user owns the business
    const business = await this.businessModel.findById(staffMember.businessId);
    if (!business || business.ownerId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to update this staff member',
      );
    }

    staffMember.isActive = !staffMember.isActive;
    await staffMember.save();

    this.customLogger.log(
      `Staff member ${id} status toggled to ${staffMember.isActive}`,
      StaffService.name,
    );

    return {
      message: `Staff member ${staffMember.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: staffMember.isActive,
    };
  }
}
