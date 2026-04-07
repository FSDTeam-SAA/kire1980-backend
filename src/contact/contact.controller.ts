import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ContactQueryDto } from './dto/contact-query.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { ApiPaginatedResponseDecorator } from '../common/decorators/api-pagination.decorator';
import { ContactInquiry } from '../database/schemas/contact-inquiry.schema';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new contact inquiry (Public)' })
  create(@Body() createContactDto: CreateContactDto) {
    return this.contactService.create(createContactDto);
  }

  @Get('all')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'List all inquiries (Admin only)' })
  @ApiPaginatedResponseDecorator(ContactInquiry)
  findAll(
    @Query() queryDto: ContactQueryDto,
    @Request() req: { user: { role: string } },
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can view contact inquiries');
    }
    return this.contactService.findAll(queryDto);
  }

  @Get(':contactId')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get a single inquiry (Admin only)' })
  @ApiParam({ name: 'contactId', description: 'The inquiry ID' })
  findOne(
    @Param('contactId') contactId: string,
    @Request() req: { user: { role: string } },
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can view contact inquiry details');
    }
    return this.contactService.findOne(contactId);
  }

  @Delete(':contactId')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Delete an inquiry (Admin only)' })
  @ApiParam({ name: 'contactId', description: 'The inquiry ID' })
  remove(
    @Param('contactId') contactId: string,
    @Request() req: { user: { role: string } },
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can delete contact inquiries');
    }
    return this.contactService.remove(contactId);
  }
}
