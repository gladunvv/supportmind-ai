import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { MembershipRole } from '../../../generated/prisma/enums';

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: MembershipRole,
    example: MembershipRole.admin,
  })
  @IsEnum(MembershipRole)
  role!: MembershipRole;
}
