import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateStaffMemberDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsMongoId()
  @IsNotEmpty()
  businessId: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  serviceIds?: string[];

  @IsString()
  @IsOptional()
  @MinLength(10, {
    message: 'Description must be at least 10 characters long',
  })
  description?: string;
}
