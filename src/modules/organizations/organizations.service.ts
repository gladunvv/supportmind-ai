import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { MembershipRole, AuditLogAction } from '../../generated/prisma/enums';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    const slug = await this.generateUniqueSlug(dto.name);

    const organization = await this.prisma.$transaction(async (tx) => {
      const createdOrganization = await tx.organization.create({
        data: {
          name: dto.name.trim(),
          slug,
          description: dto.description?.trim(),
        },
      });

      await tx.membership.create({
        data: {
          userId,
          organizationId: createdOrganization.id,
          role: MembershipRole.owner,
        },
      });

      return createdOrganization;
    });

    await this.auditService.log({
      organizationId: organization.id,
      actorUserId: userId,
      action: AuditLogAction.organization_created,
      entityType: 'organization',
      entityId: organization.id,
      metadata: {
        name: organization.name,
        slug: organization.slug,
      },
    });

    return organization;
  }

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: {
        userId,
        organization: {
          archivedAt: null,
        },
      },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return memberships.map((membership) => ({
      ...membership.organization,
      role: membership.role,
    }));
  }

  async findOneForMember(organizationId: string) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        id: organizationId,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async update(
    organizationId: string,
    userId: string,
    dto: UpdateOrganizationDto,
  ) {
    await this.ensureOrganizationExists(organizationId);

    const organization = await this.prisma.organization.update({
      where: {
        id: organizationId,
      },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditService.log({
      organizationId,
      actorUserId: userId,
      action: AuditLogAction.organization_updated,
      entityType: 'organization',
      entityId: organizationId,
      metadata: {
        name: organization.name,
        description: organization.description,
      },
    });

    return organization;
  }

  async archive(
    organizationId: string,
    userId: string,
  ): Promise<{ success: true }> {
    await this.ensureOrganizationExists(organizationId);

    await this.prisma.organization.update({
      where: {
        id: organizationId,
      },
      data: {
        archivedAt: new Date(),
      },
    });

    await this.auditService.log({
      organizationId,
      actorUserId: userId,
      action: AuditLogAction.organization_archived,
      entityType: 'organization',
      entityId: organizationId,
    });

    return { success: true };
  }

  private async ensureOrganizationExists(
    organizationId: string,
  ): Promise<void> {
    const organization = await this.prisma.organization.findFirst({
      where: {
        id: organizationId,
        archivedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = this.slugify(name);
    let slug = baseSlug;
    let counter = 1;

    while (await this.slugExists(slug)) {
      counter += 1;
      slug = `${baseSlug}-${counter}`;
    }

    return slug;
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  private async slugExists(slug: string): Promise<boolean> {
    const organization = await this.prisma.organization.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
      },
    });

    return Boolean(organization);
  }
}
