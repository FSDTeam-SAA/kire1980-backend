import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthUser, Booking, BusinessInfo, Service } from '../database/schemas';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(AuthUser.name)
    private readonly authUserModel: Model<AuthUser>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
    @InjectModel(BusinessInfo.name)
    private readonly businessInfoModel: Model<BusinessInfo>,
    @InjectModel(Service.name)
    private readonly serviceModel: Model<Service>,
  ) {}

  async getDashboardOverview() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const [
      totalCustomers,
      totalBookings,
      todayBookings,
      totalBusinesses,
      totalServices,
    ] = await Promise.all([
      this.authUserModel.countDocuments({
        role: 'customer',
        deletedAt: null,
        status: { $ne: 'DELETED' },
      }),
      this.bookingModel.countDocuments({ isDeleted: false }),
      this.bookingModel.countDocuments({
        isDeleted: false,
        'services.dateAndTime': {
          $gte: startOfToday,
          $lte: endOfToday,
        },
      }),
      this.businessInfoModel.countDocuments({ deletedAt: null }),
      this.serviceModel.countDocuments({ isActive: true }),
    ]);

    return {
      totalCustomers,
      totalBookings,
      todayBookings,
      totalBusinesses,
      totalServices,
    };
  }
}
