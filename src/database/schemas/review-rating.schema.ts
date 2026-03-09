import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'review_ratings',
})
export class ReviewRating extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'AuthUser',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'BusinessInfo',
    required: true,
    index: true,
  })
  businessId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Service',
    required: true,
    index: true,
  })
  serviceId!: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ required: true })
  review!: string;

  @Prop({ default: false })
  isDeleted?: boolean;
}

export const ReviewRatingSchema = SchemaFactory.createForClass(ReviewRating);

// Add compound index for unique review per user per service
ReviewRatingSchema.index({ userId: 1, serviceId: 1 }, { unique: true });

// Add index for business reviews
ReviewRatingSchema.index({ businessId: 1, isDeleted: 1 });
