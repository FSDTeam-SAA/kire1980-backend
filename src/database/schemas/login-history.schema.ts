import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'login_histories' })
export class LoginHistory extends Document {
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', required: true })
  authId: Types.ObjectId;

  @Prop()
  ipAddress: string;

  @Prop()
  userAgent: string;

  @Prop()
  deviceId: string;

  @Prop()
  country: string;

  @Prop()
  city: string;

  @Prop()
  latitude: string;

  @Prop()
  longitude: string;

  @Prop({ enum: ['login', 'logout'], default: 'login' })
  action: string;

  @Prop({ default: true })
  success: boolean;

  @Prop()
  failureReason: string;

  @Prop({ default: false })
  isSuspicious: boolean;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const LoginHistorySchema = SchemaFactory.createForClass(LoginHistory);
