import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'auth_users' })
export class AuthUser extends Document {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ enum: ['USER', 'ADMIN', 'MODERATOR', 'SUPERADMIN'], default: 'USER' })
  role: string;

  @Prop({ default: false })
  verified: boolean;

  @Prop({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED', 'BLOCKED'], default: 'ACTIVE' })
  status: string;

  @Prop({ default: 0 })
  tokenVersion: number;

  @Prop()
  provider: string;

  @Prop()
  providerId: string;

  @Prop({ type: Date, default: null })
  deletedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'UserProfile' })
  userProfile: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AuthSecurity' })
  authSecurity: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'LoginHistory', default: [] })
  loginHistory: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'EmailHistory', default: [] })
  emailHistory: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'ActivityLogEvent', default: [] })
  activityLogEvents: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Subscription', default: [] })
  subscriptions: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Job', default: [] })
  jobs: Types.ObjectId[];

  @Prop({ default: () => new Date() })
  createdAt: Date;

  @Prop({ default: () => new Date() })
  updatedAt: Date;
}

export const AuthUserSchema = SchemaFactory.createForClass(AuthUser);
