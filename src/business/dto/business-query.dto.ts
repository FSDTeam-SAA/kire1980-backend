
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
  @ApiPropertyOptional({ description: 'Filter by business category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    enum: BusinessFilterType,
    description: 'Filter businesses by popularity, recency, or past bookings',
  })
  @IsOptional()
  @IsEnum(BusinessFilterType)
  filterBy?: BusinessFilterType;

  @ApiPropertyOptional({ description: 'Filter by location (matches city or country)' })
  @IsOptional()
  @IsString()
  location?: string;

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
