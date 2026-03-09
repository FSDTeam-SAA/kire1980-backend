import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Sub-schema for avatar image
@Schema({ _id: false })
export class AvatarImage extends Document {
  @Prop({ required: true })
  url!: string;

  @Prop()
  publicId?: string; // For Cloudinary image management

  @Prop({ type: Date, default: () => new Date() })
  uploadedAt!: Date;
}

export const AvatarImageSchema = SchemaFactory.createForClass(AvatarImage);

@Schema({
  timestamps: true,
  collection: 'staff_members',
})
export class StaffMember extends Document {
  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ required: true, trim: true })
  lastName!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email!: string;

  @Prop({ required: true })
  phoneNumber!: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'BusinessInfo',
    required: true,
    index: true,
  })
  businessId!: Types.ObjectId;

  @Prop({
    type: [Types.ObjectId],
    ref: 'Service',
    default: [],
  })
  serviceIds!: Types.ObjectId[];

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: AvatarImageSchema })
  avatar?: AvatarImage;

  @Prop({ default: true })
  isActive?: boolean;

  @Prop({ default: false })
  isDeleted?: boolean;
}

export const StaffMemberSchema = SchemaFactory.createForClass(StaffMember);

// Add compound index for email uniqueness within a business
StaffMemberSchema.index({ email: 1, businessId: 1 }, { unique: true });

// Add index for active staff members
StaffMemberSchema.index({ businessId: 1, isActive: 1, isDeleted: 1 });
