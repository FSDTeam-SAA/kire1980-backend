import { Transform } from 'class-transformer';
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

  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          return Array.isArray(parsed) ? parsed : [String(parsed)];
        } catch {
          return [trimmed];
        }
      }

      return [trimmed];
    }

    return [String(value)];
  })
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
