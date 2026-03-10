import { Type } from 'class-transformer';
import {
  IsDate,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinDate,
} from 'class-validator';

export class CreateBookingDto {
  @IsMongoId()
  @IsNotEmpty()
  serviceId: string;

  @IsMongoId()
  @IsNotEmpty()
  businessId: string;

  @Type(() => Date)
  @IsDate()
  @MinDate(new Date(), {
    message: 'Booking date and time must be in the future',
  })
  dateAndTime: Date;

  @IsMongoId()
  @IsNotEmpty()
  selectedProvider: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
