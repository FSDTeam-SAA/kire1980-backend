import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'email_histories' })
export class EmailHistory extends Document {
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', required: true })
  authId: Types.ObjectId;

  @Prop()
  emailTo: string;

  @Prop({
    enum: ['verification', 'password_reset', 'notification'],
    default: 'notification',
  })
  emailType: string;

  @Prop({ enum: ['sendgrid', 'mailgun', 'ses', 'smtp'], default: 'smtp' })
  emailProvider: string;

  @Prop()
  messageId: string;

  @Prop({
    enum: [
      'sent',
      'failed',
      'pending',
      'bounced',
      'delivered',
      'opened',
      'clicked',
    ],
    default: 'pending',
  })
  emailStatus: string;

  @Prop({ default: 0 })
  retryCount: number;

  @Prop({ type: Date, default: null })
  sentAt: Date;

  @Prop()
  errorMessage: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;

  @Prop({ default: () => new Date() })
  updatedAt: Date;
}

export const EmailHistorySchema = SchemaFactory.createForClass(EmailHistory);
