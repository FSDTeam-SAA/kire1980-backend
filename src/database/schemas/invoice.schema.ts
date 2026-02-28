import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'invoices' })
export class Invoice extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true })
  subscriptionId: Types.ObjectId;

  @Prop({ unique: true })
  invoiceNumber: string;

  @Prop()
  amount: string;

  @Prop({
    enum: ['DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE'],
    default: 'OPEN',
  })
  status: string;

  @Prop()
  dueDate: Date;

  @Prop()
  paidAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;

  @Prop({ default: () => new Date() })
  updatedAt: Date;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
