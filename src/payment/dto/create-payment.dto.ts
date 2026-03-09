import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum PaymentType {
  FULL_REPORT = 'fullReport',
  BOOK_SEASON = 'bookSeason',
}

export class CreatePaymentDto {
  @IsString()
  userId: string;

  @IsNumber()
  totalAmount: number;

  @IsOptional()
  @IsString()
  seasonId?: string;

  @IsOptional()
  @IsString()
  successUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PaymentType)
  paymentType: PaymentType;
}
