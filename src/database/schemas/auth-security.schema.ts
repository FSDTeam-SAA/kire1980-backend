import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'auth_securities' })
export class AuthSecurity extends Document {
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', required: true })
  authId: Types.ObjectId;

  @Prop({ default: 0 })
  failedAttempts: number;

  @Prop({ type: Date, default: null })
  lastFailedAt: Date;

  @Prop({ type: Date, default: null })
  lockExpiresAt: Date;

  @Prop({ default: false })
  mfaEnabled: boolean;

  @Prop({ enum: ['totp', 'sms', 'email', 'webauthn'], default: 'totp' })
  mfaMethod: string;

  @Prop()
  mfaSecret: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;

  @Prop({ default: () => new Date() })
  updatedAt: Date;
}

export const AuthSecuritySchema = SchemaFactory.createForClass(AuthSecurity);
