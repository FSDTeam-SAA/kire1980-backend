import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'subscription_plans' })
export class SubscriptionPlan extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop()
  price: string;

  @Prop()
  currency: string;

  @Prop({ enum: ['DAY', 'WEEK', 'MONTH', 'YEAR'], default: 'MONTH' })
  interval: string;

  @Prop({ default: 0 })
  trialPeriodDays: number;

  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop({ default: () => new Date() })
  createdAt: Date;

  @Prop({ default: () => new Date() })
  updatedAt: Date;
}

export const SubscriptionPlanSchema =
  SchemaFactory.createForClass(SubscriptionPlan);
