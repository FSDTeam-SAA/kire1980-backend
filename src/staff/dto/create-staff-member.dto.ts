import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
  Matches,
  IsDate,
  IsBoolean,
} from 'class-validator';

export class WorkingScheduleDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i, {
    message: 'Day must be a valid day of the week',
  })
  day: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'from must be in HH:mm format',
  })
  from: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'to must be in HH:mm format',
  })
  to: string;
}

export class StaffExceptionScheduleDto {
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  date: Date;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean = false; // Default to false meaning they are off

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'from must be in HH:mm format',
  })
  from?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'to must be in HH:mm format',
  })
  to?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

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

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WorkingScheduleDto)
  schedule?: WorkingScheduleDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => StaffExceptionScheduleDto)
  exceptions?: StaffExceptionScheduleDto[];
}
