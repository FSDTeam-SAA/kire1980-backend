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
} from '@nestjs/common';
import type { Request } from 'express';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
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

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
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
  @UseGuards(AuthGuard)
  findOne(@Param('id') id: string) {
    return this.bookingService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() updateBookingDto: UpdateBookingDto,
  ) {
    return this.bookingService.update(id, req.user.userId, updateBookingDto);
  }

  @Patch(':id/cancel')
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
  @UseGuards(AuthGuard)
  complete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.bookingService.completeBooking(id, req.user.userId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.bookingService.remove(id, req.user.userId);
  }
}
