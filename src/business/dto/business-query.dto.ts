import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/decorators/api-pagination.decorator';

export enum BusinessFilterType {
  MOST_POPULAR = 'most_popular',
  NEW = 'new',
  BOOK_AGAIN = 'book_again',
}

export class BusinessQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(BusinessFilterType)
  filterBy?: BusinessFilterType;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  postalCode?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  zipCode?: number;
}
