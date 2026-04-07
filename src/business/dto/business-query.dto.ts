import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/decorators/api-pagination.decorator';

export class BusinessQueryDto extends PaginationDto {
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
