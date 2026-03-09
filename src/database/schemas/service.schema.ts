import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Sub-schema for service images
@Schema({ _id: false })
export class ServiceImage extends Document {
  @Prop({ required: true })
  url!: string;

  @Prop()
  publicId?: string; // For image management services like Cloudinary

  @Prop({ type: Date, default: () => new Date() })
  uploadedAt!: Date;

  @Prop()
  altText?: string; // For SEO and accessibility
}

export const ServiceImageSchema = SchemaFactory.createForClass(ServiceImage);

@Schema({
  timestamps: true,
  collection: 'services',
})
export class Service extends Document {
  @Prop({ required: true })
  serviceName!: string;

  @Prop({ required: true })
  category!: string;

  @Prop({ required: true })
  serviceDuration!: string; // e.g., "30 mins", "1 hour", "2 hours"

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ required: true })
  description!: string;

  @Prop({ type: [ServiceImageSchema], default: [] })
  serviceImages?: ServiceImage[];

  @Prop({
    type: Types.ObjectId,
    ref: 'BusinessInfo',
    required: true,
    index: true,
  })
  businessId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AuthUser', required: true, index: true })
  businessOwnerId!: Types.ObjectId;

  @Prop({ default: false })
  isFeatured!: boolean;

  @Prop({ default: 0, min: 0, max: 5 })
  averageRating!: number;

  @Prop({ default: true })
  isActive!: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);

// Add indexes for better query performance
ServiceSchema.index({ businessId: 1, isActive: 1 });
ServiceSchema.index({ category: 1, isActive: 1 });
ServiceSchema.index({ isFeatured: 1, isActive: 1 });
ServiceSchema.index({ averageRating: -1 });
