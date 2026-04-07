import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContactInquiry } from '../database/schemas/contact-inquiry.schema';
import { CreateContactDto } from './dto/create-contact.dto';
import { ContactQueryDto } from './dto/contact-query.dto';
import { createPaginatedResponse } from '../common/decorators/api-pagination.decorator';
import { EmailQueueService } from '../common/queues/email/email.queue';
import { CustomLoggerService } from '../common/services/custom-logger.service';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(ContactInquiry.name)
    private readonly contactModel: Model<ContactInquiry>,
    private readonly emailQueueService: EmailQueueService,
    private readonly customLogger: CustomLoggerService,
  ) {}

  async create(createContactDto: CreateContactDto) {
    this.customLogger.log(
      `New contact inquiry from: ${createContactDto.email}`,
      'ContactService',
    );

    const contact = await this.contactModel.create(createContactDto);

    // Queue email to admin
    await this.emailQueueService.sendAdminContactEmail(
      createContactDto.fullName,
      createContactDto.email,
      createContactDto.message,
    );

    return {
      success: true,
      message: 'Inquiry submitted successfully',
      data: contact,
    };
  }

  async findAll(queryDto: ContactQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryDto;

    const query: any = {};
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.contactModel
        .find(query)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.contactModel.countDocuments(query),
    ]);

    return createPaginatedResponse(items, total, page, limit);
  }

  async findOne(contactId: string) {
    const contact = await this.contactModel.findById(contactId).exec();
    if (!contact) {
      throw new NotFoundException(`Inquiry with ID ${contactId} not found`);
    }
    return contact;
  }

  async remove(contactId: string) {
    const result = await this.contactModel.findByIdAndDelete(contactId).exec();
    if (!result) {
      throw new NotFoundException(`Inquiry with ID ${contactId} not found`);
    }
    return {
      success: true,
      message: 'Inquiry deleted successfully',
    };
  }
}
