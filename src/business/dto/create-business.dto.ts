import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
  IsUrl,
} from 'class-validator';

export class OpeningHourDto {
  @IsString()
  @IsNotEmpty()
  day: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'openTime must be in HH:mm format',
  })
  openTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'closeTime must be in HH:mm format',
  })
  closeTime: string;
}

export class SocialMediaLinksDto {
  @IsOptional()
  @IsUrl()
  linkedin?: string;

  @IsOptional()
  @IsUrl()
  facebook?: string;

  @IsOptional()
  @IsUrl()
  instagram?: string;

  @IsOptional()
  @IsUrl()
  twitter?: string;
}

export class CreateBusinessDto {
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsEmail()
  businessEmail: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  businessCategory: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalStaff: number;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  postalCode?: number;

  @IsOptional()
  @IsString()
  sector?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialMediaLinksDto)
  socialMediaLinks?: SocialMediaLinksDto;

  @Transform(({ value }) => {
    let parsedValue = value;

    if (typeof value === 'string') {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value;
      }
    }

    if (!Array.isArray(parsedValue)) {
      return parsedValue;
    }

    return parsedValue.map((item) => plainToInstance(OpeningHourDto, item));
  })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @IsNotEmpty()
  openingHour: OpeningHourDto[];
}
