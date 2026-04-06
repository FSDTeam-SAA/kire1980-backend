import {
  Controller,
  ForbiddenException,
  Get,
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
}
