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
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
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

@ApiTags('business')
@Controller('businesses')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) { }

  // 1) Create business and store businessId into AuthUser.businessId
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new business' })
  @UseGuards(AuthGuard)
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'gallery', maxCount: 10 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
          if (!file.mimetype.startsWith('image/')) {
            cb(new BadRequestException('Only image files are allowed'), false);
            return;
          }
          cb(null, true);
        },
      },
    ),
  )
  createBusiness(
    @Req() req: AuthenticatedRequest,
    @Body() payload: CreateBusinessDto,
    @UploadedFiles()
    files: { logo?: Express.Multer.File[]; gallery?: Express.Multer.File[] },
  ) {
    return this.businessService.createBusiness(req.user.userId, payload, files);
  }

  // 2) Get all businesses
  @ApiOperation({ summary: 'Get all businesses with pagination and filters' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user business' })
  @UseGuards(AuthGuard)
  @Get('me')
  getMyBusiness(@Req() req: AuthenticatedRequest) {
    return this.businessService.getMyBusiness(req.user.userId);
  }

  // 3.1) Update single business for current user
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update current user business' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: UpdateBusinessDto,
    description: 'Update business details with optional logo and gallery files',
  })
  @UseGuards(AuthGuard)
  @Patch('me')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'gallery', maxCount: 10 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
          if (!file.mimetype.startsWith('image/')) {
            cb(new BadRequestException('Only image files are allowed'), false);
            return;
          }
          cb(null, true);
        },
      },
    ),
  )
  updateMyBusiness(
    @Req() req: AuthenticatedRequest,
    @Body() payload: UpdateBusinessDto,
    @UploadedFiles()
    files: { logo?: Express.Multer.File[]; gallery?: Express.Multer.File[] },
  ) {
    return this.businessService.updateBusiness(
      req.user.userId,
      payload,
      files,
      req.user.role,
    );
  }

  // 3.1) Business owner dashboard statistics
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get business owner dashboard statistics' })
  @UseGuards(AuthGuard)
  @Get('me/statistics')
  getMyBusinessStatistics(@Req() req: AuthenticatedRequest) {
    return this.businessService.getBusinessOwnerStatistics(
      req.user.userId,
      req.user.role,
    );
  }

  // 4) Get a single business by ID with populated data (public)
  @ApiOperation({ summary: 'Get business by ID' })
  @Get(':id')
  getBusinessById(@Param('id') id: string) {
    return this.businessService.getBusinessById(id);
  }

  // 5) Toggle business status (admin only)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Toggle business active status (Admin only)' })
  @UseGuards(AuthGuard)
  @Patch(':id/toggle-status')
  toggleBusinessStatus(
    @Param('id') businessId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.businessService.toggleBusinessStatus(businessId, req.user.role);
  }

  // 5.1) Update business by ID (Admin only)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update business by ID (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: UpdateBusinessDto,
    description: 'Update business details with optional logo and gallery files',
  })
  @UseGuards(AuthGuard)
  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'gallery', maxCount: 10 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
          if (!file.mimetype.startsWith('image/')) {
            cb(new BadRequestException('Only image files are allowed'), false);
            return;
          }
          cb(null, true);
        },
      },
    ),
  )
  updateBusinessById(
    @Param('id') businessId: string,
    @Req() req: AuthenticatedRequest,
    @Body() payload: UpdateBusinessDto,
    @UploadedFiles()
    files: { logo?: Express.Multer.File[]; gallery?: Express.Multer.File[] },
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can update any business');
    }
    return this.businessService.updateBusiness(
      null,
      payload,
      files,
      req.user.role,
      businessId,
    );
  }

  // 6) Get individual staff statistics for business owner dashboard
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get individual staff statistics' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get staff management count' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get service management count' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get booking management count' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get revenue chart data' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get upcoming appointments' })
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
