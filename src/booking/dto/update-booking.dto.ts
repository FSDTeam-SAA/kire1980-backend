import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateBookingDto } from './create-booking.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BookingStatus } from '../../database/schemas/booking.schema';

export class UpdateBookingDto extends PartialType(
  OmitType(CreateBookingDto, ['businessId', 'serviceId'] as const),
) {
  @IsEnum(BookingStatus)
  @IsOptional()
  bookingStatus?: BookingStatus;

  @IsString()
  @IsOptional()
  cancellationReason?: string;
}
