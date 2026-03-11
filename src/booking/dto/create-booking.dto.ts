import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinDate,
  ValidateNested,
} from 'class-validator';

export class CreateBookingServiceItemDto {
  @IsMongoId()
  @IsNotEmpty()
  serviceId: string;

  @Type(() => Date)
  @IsDate()
  @MinDate(new Date(), {
    message: 'Booking date and time must be in the future',
  })
  dateAndTime: Date;

  @IsMongoId()
  @IsNotEmpty()
  selectedProvider: string;
}

export class CreateBookingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBookingServiceItemDto)
  services: CreateBookingServiceItemDto[];

  @IsMongoId()
  @IsNotEmpty()
  businessId: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
