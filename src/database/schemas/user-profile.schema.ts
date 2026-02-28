import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'user_profiles' })
export class UserProfile extends Document {
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', required: true })
  authId: Types.ObjectId;

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop()
  bio: string;

  @Prop()
  avatarUrl: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;

  @Prop({ default: () => new Date() })
  updatedAt: Date;
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);
