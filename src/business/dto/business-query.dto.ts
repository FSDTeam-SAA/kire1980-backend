import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/decorators/api-pagination.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum BusinessFilterType {
  MOST_POPULAR = 'most_popular',
  NEW = 'new',
  BOOK_AGAIN = 'book_again',
}

export class BusinessQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: BusinessFilterType,
    description: 'Filter businesses by popularity, recency, or past bookings',
  })
  @IsOptional()
  @IsEnum(BusinessFilterType)
  filterBy?: BusinessFilterType;

  @ApiPropertyOptional({ description: 'Filter by city' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Filter by country' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Filter by postal code' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  postalCode?: number;

  @ApiPropertyOptional({ description: 'Filter by zip code' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  zipCode?: number;
}
