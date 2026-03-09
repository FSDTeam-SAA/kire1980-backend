import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  ParseBoolPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { StaffService } from './staff.service';
import { CreateStaffMemberDto } from './dto/create-staff-member.dto';
import { UpdateStaffMemberDto } from './dto/update-staff-member.dto';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
    }),
  )
  create(
    @Request() req,
    @Body() createStaffMemberDto: CreateStaffMemberDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.staffService.create(
      req.user.userId,
      createStaffMemberDto,
      file,
    );
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('businessId') businessId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.staffService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      businessId,
      serviceId,
      isActive !== undefined ? isActive === 'true' : undefined,
    );
  }

  @Get('business/:businessId')
  findByBusiness(
    @Param('businessId') businessId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.staffService.findByBusiness(
      businessId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
    }),
  )
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateStaffMemberDto: UpdateStaffMemberDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.staffService.update(
      id,
      req.user.userId,
      updateStaffMemberDto,
      file,
    );
  }

  @Patch(':id/toggle-status')
  @UseGuards(AuthGuard)
  toggleActiveStatus(@Param('id') id: string, @Request() req) {
    return this.staffService.toggleActiveStatus(id, req.user.userId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remove(@Param('id') id: string, @Request() req) {
    return this.staffService.remove(id, req.user.userId);
  }
}
