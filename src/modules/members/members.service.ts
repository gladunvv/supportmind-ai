import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipRole, AuditLogAction } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId: string) {
    return this.prisma.membership.findMany({
      where: {
        organizationId,
        organization: {
          archivedAt: null,
        },
      },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async addMember(
    organizationId: string,
    actorUserId: string,
    dto: AddMemberDto,
  ) {
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'User not found. MVP supports adding only already registered users.',
      );
    }

    const existingMembership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingMembership) {
      throw new ConflictException(
        'User is already a member of this organization',
      );
    }

    const membership = await this.prisma.membership.create({
      data: {
        userId: user.id,
        organizationId,
        role: dto.role,
      },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await this.auditService.log({
      organizationId,
      actorUserId,
      action: AuditLogAction.member_added,
      entityType: 'membership',
      entityId: membership.id,
      metadata: {
        email: membership.user.email,
        role: membership.role,
      },
    });

    return membership;
  }

  async updateRole(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const membership = await this.findMembershipOrThrow(
      organizationId,
      membershipId,
    );

    if (
      membership.role === MembershipRole.owner &&
      dto.role !== MembershipRole.owner
    ) {
      await this.ensureAnotherOwnerExists(organizationId, membershipId);
    }

    const updatedMembership = await this.prisma.membership.update({
      where: {
        id: membershipId,
      },
      data: {
        role: dto.role,
      },
      select: {
        id: true,
        role: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await this.auditService.log({
      organizationId,
      actorUserId,
      action: AuditLogAction.member_role_updated,
      entityType: 'membership',
      entityId: membershipId,
      metadata: {
        previousRole: membership.role,
        newRole: updatedMembership.role,
      },
    });

    return updatedMembership;
  }

  async removeMember(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
  ) {
    const membership = await this.findMembershipOrThrow(
      organizationId,
      membershipId,
    );

    if (membership.role === MembershipRole.owner) {
      await this.ensureAnotherOwnerExists(organizationId, membershipId);
    }

    await this.prisma.membership.delete({
      where: {
        id: membershipId,
      },
    });

    await this.auditService.log({
      organizationId,
      actorUserId,
      action: AuditLogAction.member_removed,
      entityType: 'membership',
      entityId: membershipId,
      metadata: {
        previousRole: membership.role,
      },
    });

    return { success: true };
  }

  private async findMembershipOrThrow(
    organizationId: string,
    membershipId: string,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
        organization: {
          archivedAt: null,
        },
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    return membership;
  }

  private async ensureAnotherOwnerExists(
    organizationId: string,
    excludedMembershipId: string,
  ): Promise<void> {
    const anotherOwner = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        id: {
          not: excludedMembershipId,
        },
        role: MembershipRole.owner,
      },
      select: {
        id: true,
      },
    });

    if (!anotherOwner) {
      throw new BadRequestException(
        'Organization must have at least one owner',
      );
    }
  }
}
