import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsIn,
  NotEquals,
} from 'class-validator';

export class CreateAuthDto {
  @Transform(({ value, obj }) => value ?? obj.username)
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsString()
  @IsIn(['customer', 'businessowner'], {
    message: 'role must be either customer or businessowner',
  })
  role?: string;
}
