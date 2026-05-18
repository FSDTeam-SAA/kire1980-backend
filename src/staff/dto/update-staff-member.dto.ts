import { PartialType } from '@nestjs/mapped-types';
import { CreateStaffMemberDto } from './create-staff-member.dto';
import { OmitType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional, ValidateIf } from 'class-validator';

export class UpdateStaffMemberDto extends PartialType(
  OmitType(CreateStaffMemberDto, ['businessId'] as const),
) {
  // businessId will be ignored if sent by client - it's read-only
  @ValidateIf(() => false)
  businessId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
