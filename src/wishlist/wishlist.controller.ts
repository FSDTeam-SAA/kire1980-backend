import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('wishlists')
@UseGuards(AuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Post('business/:businessId')
  saveBusiness(
    @Request() req: { user: { userId: string } },
    @Param('businessId') businessId: string,
  ) {
    return this.wishlistService.saveBusiness(req.user.userId, businessId);
  }

  @Get('me')
  getMyWishlist(@Request() req: { user: { userId: string } }) {
    return this.wishlistService.getMyWishlist(req.user.userId);
  }

  @Delete('business/:businessId')
  removeBusiness(
    @Request() req: { user: { userId: string } },
    @Param('businessId') businessId: string,
  ) {
    return this.wishlistService.removeBusiness(req.user.userId, businessId);
  }

  @Get('business/:businessId/status')
  getSaveStatus(
    @Request() req: { user: { userId: string } },
    @Param('businessId') businessId: string,
  ) {
    return this.wishlistService.isBusinessSaved(req.user.userId, businessId);
  }
}
