import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { MembershipRole } from '../../generated/prisma/enums';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    const slug = await this.generateUniqueSlug(dto.name);

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.name.trim(),
          slug,
          description: dto.description?.trim(),
        },
      });

      await tx.membership.create({
        data: {
          userId,
          organizationId: organization.id,
          role: MembershipRole.owner,
        },
      });

      return organization;
    });
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

  async update(organizationId: string, dto: UpdateOrganizationDto) {
    await this.ensureOrganizationExists(organizationId);

    return this.prisma.organization.update({
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
  }

  async archive(organizationId: string): Promise<{ success: true }> {
    await this.ensureOrganizationExists(organizationId);

    await this.prisma.organization.update({
      where: {
        id: organizationId,
      },
      data: {
        archivedAt: new Date(),
      },
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
