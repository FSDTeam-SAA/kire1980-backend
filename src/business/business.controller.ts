import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
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
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import {
  ApiPaginatedResponseDecorator,
  PaginationDto,
} from '../common/decorators/api-pagination.decorator';
import { BusinessInfo } from '../database/schemas';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
    tokenVersion: number;
  };
}

@Controller('businesses')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  // 1) Create business and store businessId into AuthUser.businessId
  @UseGuards(AuthGuard)
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
  @UseGuards(OptionalAuthGuard)
  @Get()
  @ApiPaginatedResponseDecorator(BusinessInfo)
  getAllBusinesses(
    @Query() query: PaginationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.businessService.getAllBusinesses(query, req.user);
  }

  // 3) Get single business for current user from access token
  @UseGuards(AuthGuard)
  @Get('me')
  getMyBusiness(@Req() req: AuthenticatedRequest) {
    return this.businessService.getMyBusiness(req.user.userId);
  }

  // 3.1) Business owner dashboard statistics
  @UseGuards(AuthGuard)
  @Get('me/statistics')
  getMyBusinessStatistics(@Req() req: AuthenticatedRequest) {
    return this.businessService.getBusinessOwnerStatistics(
      req.user.userId,
      req.user.role,
    );
  }

  // 4) Get a single business by ID with populated data (public)
  @Get(':id')
  getBusinessById(@Param('id') id: string) {
    return this.businessService.getBusinessById(id);
  }

  // 5) Toggle business status (admin only)
  @UseGuards(AuthGuard)
  @Patch(':id/toggle-status')
  toggleBusinessStatus(
    @Param('id') businessId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.businessService.toggleBusinessStatus(businessId, req.user.role);
  }
}
