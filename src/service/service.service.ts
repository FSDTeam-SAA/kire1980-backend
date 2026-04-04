import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Service, BusinessInfo, AuthUser } from '../database/schemas';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CustomLoggerService } from '../common/services/custom-logger.service';
import { CloudinaryService } from '../common/services/cloudinary.service';

@Injectable()
export class ServiceService {
  constructor(
    @InjectModel(Service.name)
    private readonly serviceModel: Model<Service>,
    @InjectModel(BusinessInfo.name)
    private readonly businessModel: Model<BusinessInfo>,
    @InjectModel(AuthUser.name)
    private readonly authUserModel: Model<AuthUser>,
    private readonly customLogger: CustomLoggerService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(
    userId: string,
    createServiceDto: CreateServiceDto,
    files: Array<Express.Multer.File> = [],
  ) {
    // Verify business exists
    const business = await this.businessModel.findById(
      createServiceDto.businessId,
    );
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // Verify user owns the business
    if (business.ownerId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to create services for this business',
      );
    }

    // Upload service images
    const uploadedImages = await Promise.all(
      (files || []).map(async (file) => {
        const uploaded = await this.cloudinaryService.uploadImage(
          file.buffer,
          'service-images',
        );
        return {
          url: uploaded.url,
          publicId: uploaded.publicId,
          uploadedAt: new Date(),
        };
      }),
    );

    const service = new this.serviceModel({
      ...createServiceDto,
      businessOwnerId: new Types.ObjectId(userId),
      serviceImages: uploadedImages,
    });

    await service.save();
    this.customLogger.log(
      `Service created: ${service._id}`,
      ServiceService.name,
    );

    return service;
  }

  async findAll(filters: {
    businessId?: string;
    category?: string;
    isActive?: boolean;
    isFeatured?: boolean;
  }) {
    const query: any = {};

    if (filters.businessId) {
      query.businessId = {
        $in: [filters.businessId, new Types.ObjectId(filters.businessId)],
      };
    }
    if (filters.category) {
      query.category = filters.category;
    }
    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }
    if (filters.isFeatured !== undefined) {
      query.isFeatured = filters.isFeatured;
    }

    return this.serviceModel
      .find(query)
      .populate('businessId', 'businessName businessEmail')
      .populate('businessOwnerId', 'email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid service ID');
    }

    const service = await this.serviceModel
      .findById(id)
      .populate('businessId', 'businessName businessEmail phoneNumber')
      .populate('businessOwnerId', 'email')
      .exec();

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  async findByBusiness(businessId: string) {
    if (!Types.ObjectId.isValid(businessId)) {
      throw new BadRequestException('Invalid business ID');
    }

    return this.serviceModel
      .find({
        businessId: {
          $in: [businessId, new Types.ObjectId(businessId)],
        },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async update(
    id: string,
    userId: string,
    updateServiceDto: UpdateServiceDto,
    files: Array<Express.Multer.File> = [],
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid service ID');
    }

    const service = await this.serviceModel.findById(id);
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Verify user owns the service
    if (service.businessOwnerId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to update this service',
      );
    }

    // Upload new images if provided
    if (files && files.length > 0) {
      const uploadedImages = await Promise.all(
        files.map(async (file) => {
          const uploaded = await this.cloudinaryService.uploadImage(
            file.buffer,
            'service-images',
          );
          return {
            url: uploaded.url,
            publicId: uploaded.publicId,
            uploadedAt: new Date(),
          };
        }),
      );

      updateServiceDto['serviceImages'] = [
        ...(service.serviceImages || []),
        ...uploadedImages,
      ];
    }

    Object.assign(service, updateServiceDto);
    await service.save();

    this.customLogger.log(
      `Service updated: ${service._id}`,
      ServiceService.name,
    );
    return service;
  }

  async remove(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid service ID');
    }

    const service = await this.serviceModel.findById(id);
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Verify user owns the service
    if (service.businessOwnerId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to delete this service',
      );
    }

    // Delete images from cloudinary
    if (service.serviceImages && service.serviceImages.length > 0) {
      await Promise.all(
        service.serviceImages.map(async (img) => {
          if (img.publicId) {
            try {
              await this.cloudinaryService.deleteImage(img.publicId);
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              this.customLogger.warn(
                `Failed to delete image ${img.publicId}: ${errorMessage}`,
                ServiceService.name,
              );
            }
          }
        }),
      );
    }

    await this.serviceModel.findByIdAndDelete(id);
    this.customLogger.log(`Service deleted: ${id}`, ServiceService.name);

    return { message: 'Service deleted successfully' };
  }

  async toggleActive(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid service ID');
    }

    const service = await this.serviceModel.findById(id);
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Verify user owns the service
    if (service.businessOwnerId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to modify this service',
      );
    }

    service.isActive = !service.isActive;
    await service.save();

    this.customLogger.log(
      `Service ${service._id} ${service.isActive ? 'activated' : 'deactivated'}`,
      ServiceService.name,
    );

    return service;
  }
}
