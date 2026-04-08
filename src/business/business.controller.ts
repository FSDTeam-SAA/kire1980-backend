import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
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
import { BusinessQueryDto } from './dto/business-query.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { ApiPaginatedResponseDecorator } from '../common/decorators/api-pagination.decorator';
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
    @Query() query: BusinessQueryDto,
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

  // 6) Get individual staff statistics for business owner dashboard
  @UseGuards(AuthGuard)
  @Get('dashboard/staff-individual-stats/:id')
  getStaffIndividualStats(
    @Param('id') staffId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (req.user.role !== 'businessowner' && req.user.role !== 'admin') {
      throw new ForbiddenException(
        'Only business owners can access staff statistics',
      );
    }

    return this.businessService.getStaffIndividualStats(
      req.user.userId,
      staffId,
    );
  }

  // 7) Get staff management statistics for business owner dashboard
  @UseGuards(AuthGuard)
  @Get('dashboard/staff-management-count')
  getStaffManagementCount(@Req() req: AuthenticatedRequest) {
    if (req.user.role !== 'businessowner' && req.user.role !== 'admin') {
      throw new ForbiddenException(
        'Only business owners can access staff management statistics',
      );
    }

    return this.businessService.getStaffManagementCount(req.user.userId);
  }

  // 8) Get service management statistics for business owner dashboard
  @UseGuards(AuthGuard)
  @Get('dashboard/service-management-count')
  getServiceManagementCount(@Req() req: AuthenticatedRequest) {
    if (req.user.role !== 'businessowner' && req.user.role !== 'admin') {
      throw new ForbiddenException(
        'Only business owners can access service management statistics',
      );
    }

    return this.businessService.getServiceManagementCount(req.user.userId);
  }

  // 8.1) Get booking management count for business owner dashboard
  @UseGuards(AuthGuard)
  @Get('dashboard/booking-management-count')
  getBookingManagementCount(@Req() req: AuthenticatedRequest) {
    if (req.user.role !== 'businessowner' && req.user.role !== 'admin') {
      throw new ForbiddenException(
        'Only business owners can access booking management statistics',
      );
    }

    return this.businessService.getBookingManagementCount(req.user.userId);
  }

  // 9) Get revenue chart data for business owner dashboard
  @UseGuards(AuthGuard)
  @Get('dashboard/revenue-chart')
  getRevenueChartData(
    @Req() req: AuthenticatedRequest,
    @Query('viewType') viewType: 'yearly' | 'monthly' | 'weekly' = 'yearly',
  ) {
    if (req.user.role !== 'businessowner' && req.user.role !== 'admin') {
      throw new ForbiddenException(
        'Only business owners can access revenue chart statistics',
      );
    }

    return this.businessService.getRevenueChartData(req.user.userId, viewType);
  }

  // 10) Get upcoming appointments for business owner dashboard
  @UseGuards(AuthGuard)
  @Get('dashboard/upcoming-appointments')
  getUpcomingAppointments(@Req() req: AuthenticatedRequest) {
    if (req.user.role !== 'businessowner' && req.user.role !== 'admin') {
      throw new ForbiddenException(
        'Only business owners can access upcoming appointments',
      );
    }

    return this.businessService.getUpcomingAppointments(req.user.userId);
  }
}
