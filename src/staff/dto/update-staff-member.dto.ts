import { PartialType } from '@nestjs/mapped-types';
import { CreateStaffMemberDto } from './create-staff-member.dto';
import { OmitType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateStaffMemberDto extends PartialType(
  OmitType(CreateStaffMemberDto, ['businessId'] as const),
) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
