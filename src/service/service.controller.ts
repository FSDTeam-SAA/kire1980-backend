import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { AuthGuard } from '../common/guards/auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    role: string;
    tokenVersion: number;
  };
}

@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FilesInterceptor('serviceImages', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() createServiceDto: CreateServiceDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.serviceService.create(req.user.userId, createServiceDto, files);
  }

  @Get()
  async findAll(
    @Query('title') title?: string,
    @Query('location') location?: string,
    @Query('category') category?: string,
  ) {
    const filters: {
      searchTitle?: string;
      location?: string;
      category?: string;
    } = {};

    if (title?.trim()) filters.searchTitle = title.trim();
    if (location?.trim()) filters.location = location.trim();
    if (category?.trim()) filters.category = category.trim();

    return this.serviceService.findAll(filters);
  }

  @Get('business/:businessId')
  async findByBusiness(@Param('businessId') businessId: string) {
    return this.serviceService.findByBusiness(businessId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.serviceService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FilesInterceptor('serviceImages', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async update(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() updateServiceDto: UpdateServiceDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.serviceService.update(
      id,
      req.user.userId,
      updateServiceDto,
      files,
    );
  }

  @Patch(':id/toggle-active')
  @UseGuards(AuthGuard)
  async toggleActive(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.serviceService.toggleActive(id, req.user.userId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.serviceService.remove(id, req.user.userId);
  }
}
