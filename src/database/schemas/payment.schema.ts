import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'payments' })
export class Payment extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true })
  subscriptionId: Types.ObjectId;

  @Prop()
  amount: string;

  @Prop()
  currency: string;

  @Prop({
    enum: [
      'PENDING',
      'PROCESSING',
      'SUCCEEDED',
      'FAILED',
      'CANCELED',
      'REFUNDED',
    ],
    default: 'PENDING',
  })
  status: string;

  @Prop()
  provider: string;

  @Prop()
  providerPaymentId: string;

  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop({ default: () => new Date() })
  createdAt: Date;

  @Prop({ default: () => new Date() })
  updatedAt: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
