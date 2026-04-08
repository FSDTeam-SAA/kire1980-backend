import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
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

  @Delete('businesses/:businessId')
  async deleteBusiness(
    @Request() req: { user: { role: string } },
    @Param('businessId') businessId: string,
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can delete business');
    }

    const result: { businessId: string } =
      await this.adminService.deleteBusinessByAdmin(businessId);

    return {
      success: true,
      message: 'Business deleted successfully',
      data: result,
    };
  }

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

  @Get('top-businesses-by-payment')
  async getTopBusinessesByPayment(@Request() req: { user: { role: string } }) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException(
        'Only admin can access top businesses by payment',
      );
    }

    const topBusinesses = await this.adminService.getTopBusinessesByPayment(3);

    return {
      success: true,
      message: 'Top businesses by payment retrieved successfully',
      data: topBusinesses,
    };
  }

  @Get('staff-management-stats')
  async getStaffManagementStats(@Request() req: { user: { role: string } }) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can access staff management stats');
    }

    const stats = await this.adminService.getStaffManagementStats();

    return {
      success: true,
      message: 'Staff management statistics retrieved successfully',
      data: stats,
    };
  }
}
