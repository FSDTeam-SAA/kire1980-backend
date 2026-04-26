import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Enum for booking status
export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

@Schema({ _id: false })
class BookingItem {
  @Prop({
    type: Types.ObjectId,
    ref: 'Service',
    required: true,
  })
  serviceId!: Types.ObjectId;

  @Prop({
    type: Date,
    required: true,
  })
  dateAndTime!: Date;

  @Prop({
    type: Types.ObjectId,
    ref: 'StaffMember',
    required: true,
  })
  selectedProvider!: Types.ObjectId;
}

const BookingItemSchema = SchemaFactory.createForClass(BookingItem);

@Schema({
  timestamps: true,
  collection: 'bookings',
})
export class Booking extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'AuthUser',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({
    type: [BookingItemSchema],
    required: true,
    validate: {
      validator: (value: BookingItem[]) =>
        Array.isArray(value) && value.length > 0,
      message: 'At least one service is required for a booking',
    },
  })
  services!: BookingItem[];

  @Prop({
    type: Types.ObjectId,
    ref: 'BusinessInfo',
    required: true,
    index: true,
  })
  businessId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(BookingStatus),
    default: BookingStatus.PENDING,
  })
  bookingStatus!: BookingStatus;

  @Prop()
  notes?: string;

  @Prop({ type: Date })
  confirmedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Date })
  cancelledAt?: Date;

  @Prop()
  cancellationReason?: string;

  @Prop({ default: false })
  isDeleted?: boolean;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

// Add compound indexes for efficient queries
BookingSchema.index({ userId: 1, bookingStatus: 1, isDeleted: 1 });
BookingSchema.index({
  businessId: 1,
  'services.dateAndTime': 1,
  bookingStatus: 1,
  isDeleted: 1,
});
BookingSchema.index({
  'services.selectedProvider': 1,
  'services.dateAndTime': 1,
});
BookingSchema.index({ 'services.serviceId': 1, bookingStatus: 1 });
