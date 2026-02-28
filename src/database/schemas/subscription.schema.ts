import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'subscriptions' })
export class Subscription extends Document {
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', required: true })
  authId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SubscriptionPlan', required: true })
  planId: Types.ObjectId;

  @Prop({
    enum: [
      'ACTIVE',
      'PAST_DUE',
      'CANCELED',
      'TRIALING',
      'INCOMPLETE',
      'INCOMPLETE_EXPIRED',
      'UNPAID',
    ],
    default: 'TRIALING',
  })
  status: string;

  @Prop()
  startDate: Date;

  @Prop()
  endDate: Date;

  @Prop()
  canceledDate: Date;

  @Prop({ type: [Types.ObjectId], ref: 'Payment', default: [] })
  payments: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Invoice', default: [] })
  invoices: Types.ObjectId[];

  @Prop({ default: () => new Date() })
  createdAt: Date;

  @Prop({ default: () => new Date() })
  updatedAt: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
