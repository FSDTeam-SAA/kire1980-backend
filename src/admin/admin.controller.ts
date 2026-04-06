import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminService } from './admin.service';

@Controller('admin/dashboard')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  async getOverview(@Request() req: { user: { role: string } }) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can access dashboard overview');
    }

    const overview = await this.adminService.getDashboardOverview();

    return {
      success: true,
      message: 'Dashboard overview retrieved successfully',
      data: overview,
    };
  }

  @Get('bookings-trend')
  async getBookingsTrend(
    @Request() req: { user: { role: string } },
    @Query('year') year?: string,
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can access booking trends');
    }

    const parsedYear = year ? Number(year) : undefined;
    const bookingTrend = await this.adminService.getBookingTrends(parsedYear);

    return {
      success: true,
      message: 'Booking trend data retrieved successfully',
      data: bookingTrend,
    };
  }
}
