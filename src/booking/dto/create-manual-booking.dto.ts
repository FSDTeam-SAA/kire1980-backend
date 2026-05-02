import { IsString, IsArray, IsOptional, IsEmail, IsPhoneNumber, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ServiceForManualBookingDto {
  @IsString()
  serviceId: string;

  @Type(() => Date)
  dateAndTime: Date;

  @IsString()
  selectedProvider: string; // Staff member ID
}

export class CreateManualBookingDto {
  // Customer info - either existing customer ID or new customer details
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsPhoneNumber()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  // Booking services
  @IsArray()
  @Type(() => ServiceForManualBookingDto)
  services: ServiceForManualBookingDto[];

  // Optional booking details
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;
}
