import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getAnalytics() {
    const analytics = await this.analyticsService.getAnalytics();
    return {
      success: true,
      message: 'Analytics overview retrieved successfully',
      data: analytics,
    };
  }
}
