import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { AuthGuard } from '../common/guards/auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    role: string;
    tokenVersion: number;
  };
}

@Controller('businesses')
@UseGuards(AuthGuard)
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  // 1) Create business and store businessId into AuthUser.businessId
  @Post()
  @UseInterceptors(
    FilesInterceptor('gallery', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  createBusiness(
    @Req() req: AuthenticatedRequest,
    @Body() payload: CreateBusinessDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.businessService.createBusiness(req.user.userId, payload, files);
  }

  // 2) Get all businesses
  @Get()
  getAllBusinesses() {
    return this.businessService.getAllBusinesses();
  }

  // 3) Get single business for current user from access token
  @Get('me')
  getMyBusiness(@Req() req: AuthenticatedRequest) {
    return this.businessService.getMyBusiness(req.user.userId);
  }

  // 4) Get a single business by ID with populated data (public)
  @Get(':id')
  @UseGuards() // no guard — public endpoint
  getBusinessById(@Param('id') id: string) {
    return this.businessService.getBusinessById(id);
  }

  // 5) Activate business (admin only)
  @Patch(':id/activate')
  activateBusiness(
    @Param('id') businessId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.businessService.activateBusiness(businessId, req.user.role);
  }
}
