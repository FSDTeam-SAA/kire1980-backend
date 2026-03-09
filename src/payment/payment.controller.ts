import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /* Create Stripe Payment */
  @Public()
  @Post('stripe/create')
  createStripePayment(@Body() dto: CreatePaymentDto) {
    return this.paymentService.createStripePayment(dto);
  }

  /* Get all payments (admin) */
  @Public()
  @Get()
  getAllPayments() {
    return this.paymentService.getAllPayments();
  }

  /* Get payments by user */
  @Get('user/:userId')
  getPaymentsByUser(@Param('userId') userId: string) {
    return this.paymentService.getPaymentsByUser(userId);
  }

  /* Get single payment */
  @Get(':id')
  getPayment(@Param('id') id: string) {
    return this.paymentService.getPaymentById(id);
  }
}
