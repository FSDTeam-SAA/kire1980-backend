import { PartialType } from '@nestjs/mapped-types';
import { CreateStaffMemberDto } from './create-staff-member.dto';
import { OmitType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { Exclude } from 'class-transformer';

export class UpdateStaffMemberDto extends PartialType(
  OmitType(CreateStaffMemberDto, ['businessId'] as const),
) {
  @Exclude()
  businessId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
