import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { PaymentRecord, PaymentDocument } from './paymentRecord';
import { CreatePaymentDto, PaymentType } from './dto/create-payment.dto';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  constructor(
    @InjectModel(PaymentRecord.name)
    private paymentModel: Model<PaymentDocument>,
  ) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error(
        'STRIPE_SECRET_KEY is not defined in environment variables. Please add it to your .env file.',
      );
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-11-17.clover',
    });
  }

  // ✅ SUCCESS URL RESOLVER
  private getSuccessUrl(paymentType: PaymentType): string {
    switch (paymentType) {
      case PaymentType.FULL_REPORT:
        return (
          process.env.STRIPE_FULL_REPORT_SUCCESS_URL ||
          'http://localhost:3000/full-report'
        );

      case PaymentType.BOOK_SEASON:
        return (
          process.env.STRIPE_BOOK_SEASON_SUCCESS_URL ||
          'http://localhost:3000/success'
        );

      default:
        return (
          process.env.STRIPE_SUCCESS_URL ||
          'http://localhost:3000/payment/success'
        );
    }
  }

  /* Create Stripe Checkout Session */
  async createStripePayment(dto: CreatePaymentDto) {
    const successUrl = this.getSuccessUrl(dto.paymentType);
    console.log('siccessUrl', successUrl);
    const cancelUrl =
      dto.cancelUrl ||
      process.env.STRIPE_CANCEL_URL ||
      'http://localhost:3000/payment/cancel';

    // Create a Checkout Session so we can send the hosted payment page URL back to the client
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: dto.description || 'Payment' },
            unit_amount: Math.round(dto.totalAmount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        userId: dto.userId,
        seasonId: dto.seasonId || '',
      },
    });

    const payment = await this.paymentModel.create({
      userId: dto.userId,
      seasonId: dto.seasonId,
      paymentType: dto.paymentType,
      paymentIntent: (session.payment_intent as string) || undefined,
      checkoutSessionId: session.id,
      totalAmount: dto.totalAmount,
      paymentStatus: 'pending',
    });

    return {
      checkoutUrl: session.url, // Hosted Stripe Checkout page
      paymentId: payment._id,
    };
  }

  /* Update payment status (for webhook or manual update) */
  async updatePaymentStatus(paymentIntent: string, status: string) {
    return this.paymentModel.findOneAndUpdate(
      { paymentIntent },
      { paymentStatus: status },
      { new: true },
    );
  }

  /* Get all payments */
  async getAllPayments() {
    return this.paymentModel.find().sort({ createdAt: -1 });
  }

  /* Get payments by user */
  async getPaymentsByUser(userId: string) {
    return this.paymentModel.find({ userId }).sort({ createdAt: -1 });
  }

  /* Get single payment */
  async getPaymentById(id: string) {
    return this.paymentModel.findById(id);
  }
}
