import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Enum for business status
export enum BusinessStatus {
  PENDING = 'pending',
  ACTIVATED = 'activated',
  DEACTIVATED = 'deactivated',
}

// Enum for verification status
export enum BusinessVerification {
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

// Sub-schema for opening hours
@Schema({ _id: false })
export class OpeningHour extends Document {
  @Prop({ required: true })
  day!: string; // Monday, Tuesday, etc.

  @Prop({ required: true })
  openTime!: string; // HH:mm format (e.g., "09:00")

  @Prop({ required: true })
  closeTime!: string; // HH:mm format (e.g., "17:00")

  @Prop({ default: true })
  isOpen?: boolean; // To allow marking days as closed
}

// Sub-schema for gallery images
@Schema({ _id: false })
export class GalleryImage extends Document {
  @Prop({ required: true })
  url!: string;

  @Prop()
  publicId?: string; // For image management services like Cloudinary

  @Prop({ type: Date, default: () => new Date() })
  uploadedAt!: Date;

  @Prop()
  altText?: string; // For SEO and accessibility
}

@Schema({ _id: false })
export class SocialMediaLinks extends Document {
  @Prop()
  linkedin?: string;

  @Prop()
  facebook?: string;

  @Prop()
  instagram?: string;

  @Prop()
  twitter?: string;
}

// Main Business schema
@Schema({ collection: 'business_info', timestamps: true })
export class BusinessInfo extends Document {
  @Prop({ required: true })
  businessName!: string;

  @Prop({ required: true, unique: true })
  businessEmail!: string;

  @Prop({ required: true })
  phoneNumber!: string;

  @Prop({ required: true })
  businessCategory!: string;

  @Prop({ required: true, min: 1 })
  totalStaff!: number;

  @Prop({ enum: BusinessStatus, default: BusinessStatus.PENDING })
  status!: string;

  @Prop({ required: true })
  country!: string;

  @Prop({ required: true })
  city!: string;

  @Prop()
  postalCode?: number;

  @Prop()
  sector?: string;

  @Prop({ type: [GalleryImage], default: [] })
  gallery!: GalleryImage[];

  @Prop()
  description?: string;

  @Prop({
    enum: BusinessVerification,
    default: BusinessVerification.UNVERIFIED,
  })
  verification!: string;

  @Prop({ type: [OpeningHour], default: [] })
  openingHours!: OpeningHour[];

  // Related fields
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', required: true })
  ownerId!: Types.ObjectId; // Reference to the business owner user

  @Prop({ type: [Types.ObjectId], ref: 'AuthUser', default: [] })
  staffIds!: Types.ObjectId[]; // References to staff members

  @Prop({ type: [Types.ObjectId], ref: 'Review', default: [] })
  reviews!: Types.ObjectId[]; // Reviews of this business

  @Prop()
  website?: string; // Business website

  @Prop({ type: SocialMediaLinks, default: null })
  socialMediaLinks?: SocialMediaLinks;

  @Prop({ default: () => new Date() })
  createdAt!: Date;

  @Prop({ default: () => new Date() })
  updatedAt!: Date;

  @Prop({ type: Date, default: null })
  deletedAt?: Date; // For soft delete
}

export const BusinessInfoSchema = SchemaFactory.createForClass(BusinessInfo);

// Indexes for search/filter performance
BusinessInfoSchema.index({ city: 1 });
BusinessInfoSchema.index({ country: 1 });
BusinessInfoSchema.index({ postalCode: 1 });
BusinessInfoSchema.index({ country: 1, city: 1, postalCode: 1 });
