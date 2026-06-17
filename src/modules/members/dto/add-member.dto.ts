import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';
import { MembershipRole } from '../../../generated/prisma/enums';

export class AddMemberDto {
  @ApiProperty({
    example: 'agent@supportmind.dev',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    enum: MembershipRole,
    example: MembershipRole.support_agent,
  })
  @IsEnum(MembershipRole)
  role!: MembershipRole;
}
