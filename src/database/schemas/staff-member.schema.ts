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

@Schema({ _id: false })
export class WorkingSchedule extends Document {
  @Prop({ required: true, trim: true, lowercase: true })
  day!: string;

  @Prop({ required: true, trim: true })
  from!: string;

  @Prop({ required: true, trim: true })
  to!: string;
}

export const WorkingScheduleSchema =
  SchemaFactory.createForClass(WorkingSchedule);

@Schema({ _id: false })
export class StaffExceptionSchedule extends Document {
  @Prop({ required: true, type: Date })
  date!: Date; // The specific day the staff is unavailable (e.g., '2024-05-20')

  @Prop({ required: true, default: false })
  isAvailable!: boolean; // False if they are off, True if they have special hours

  @Prop({ trim: true })
  from?: string; // Optional: If they are available for specific hours on this day

  @Prop({ trim: true })
  to?: string; // Optional: If they are available for specific hours on this day

  @Prop({ trim: true })
  reason?: string; // e.g., "Medical leave", "Public holiday"
}

export const StaffExceptionScheduleSchema =
  SchemaFactory.createForClass(StaffExceptionSchedule);

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

  @Prop({ type: [WorkingScheduleSchema], default: [] })
  schedule?: WorkingSchedule[];

  @Prop({ type: [StaffExceptionScheduleSchema], default: [] })
  exceptions?: StaffExceptionSchedule[];

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
