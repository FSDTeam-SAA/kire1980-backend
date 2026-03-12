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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { StaffService } from './staff.service';
import { CreateStaffMemberDto } from './dto/create-staff-member.dto';
import { UpdateStaffMemberDto } from './dto/update-staff-member.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { THROTTLER_CONFIG } from '../common/config/throttler.config';

@Controller('staff')
@Throttle({ default: THROTTLER_CONFIG.RELAXED })
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      fileFilter: (req, file, cb) => {
        if (!/\/(jpg|jpeg|png|gif|webp)$/.exec(file.mimetype)) {
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
      page ? Number.parseInt(page, 10) : 1,
      limit ? Number.parseInt(limit, 10) : 10,
      businessId,
      serviceId,
      isActive === undefined ? undefined : isActive === 'true',
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
      page ? Number.parseInt(page, 10) : 1,
      limit ? Number.parseInt(limit, 10) : 10,
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
        if (!/\/(jpg|jpeg|png|gif|webp)$/.exec(file.mimetype)) {
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
