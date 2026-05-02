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
  Req,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateManualBookingDto } from './dto/create-manual-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { BookingStatus } from '../database/schemas/booking.schema';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    role: string;
    tokenVersion: number;
  };
}

@ApiTags('booking')
@ApiBearerAuth('JWT-auth')
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post('manual')
  @ApiOperation({ summary: 'Create manual booking (business owner only)' })
  @UseGuards(AuthGuard)
  async createManualBooking(
    @Req() req: AuthenticatedRequest,
    @Body() createManualBookingDto: CreateManualBookingDto,
  ) {
    // Check if user is business owner
    if (req.user.role !== 'business_owner') {
      throw new ForbiddenException('Only business owners can create manual bookings');
    }

    return this.bookingService.createManualBooking(
      req.user.userId,
      createManualBookingDto,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a new booking' })
  @UseGuards(AuthGuard)
  create(
    @Req() req: AuthenticatedRequest,
    @Body() createBookingDto: CreateBookingDto,
  ) {
    return this.bookingService.create(req.user.userId, createBookingDto);
  }

  @Get()
  @UseGuards(AuthGuard)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('businessId') businessId?: string,
    @Query('status') status?: BookingStatus,
    @Query() query?: Record<string, string>,
  ) {
    const title = query?.title;
    const serviceTitle = query?.serviceTitle;

    return this.bookingService.findAll(
      page ? Number.parseInt(page, 10) : 1,
      limit ? Number.parseInt(limit, 10) : 10,
      userId,
      businessId,
      status,
      title,
      serviceTitle,
    );
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all bookings for a specific user' })
  @UseGuards(AuthGuard)
  findUserBookings(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bookingService.findUserBookings(
      userId,
      page ? Number.parseInt(page, 10) : 1,
      limit ? Number.parseInt(limit, 10) : 10,
    );
  }

  @Get('business/:businessId')
  @ApiOperation({ summary: 'Get all bookings for a specific business' })
  @UseGuards(AuthGuard)
  findBusinessBookings(
    @Param('businessId') businessId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bookingService.findBusinessBookings(
      businessId,
      page ? Number.parseInt(page, 10) : 1,
      limit ? Number.parseInt(limit, 10) : 10,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking by ID' })
  @UseGuards(AuthGuard)
  findOne(@Param('id') id: string) {
    return this.bookingService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a booking' })
  @UseGuards(AuthGuard)
  update(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() updateBookingDto: UpdateBookingDto,
  ) {
    return this.bookingService.update(id, req.user.userId, updateBookingDto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  @UseGuards(AuthGuard)
  cancel(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body('cancellationReason') cancellationReason?: string,
  ) {
    return this.bookingService.cancelBooking(
      id,
      req.user.userId,
      cancellationReason,
    );
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark a booking as completed' })
  @UseGuards(AuthGuard)
  complete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.bookingService.completeBooking(id, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a booking' })
  @UseGuards(AuthGuard)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.bookingService.remove(id, req.user.userId);
  }
}
