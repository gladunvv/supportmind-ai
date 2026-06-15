import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestWithOrganization } from '../types/request-with-organization.type';

@Injectable()
export class OrganizationMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithOrganization>();
    const user = request.user;
    const organizationId = request.params.organizationId;

    if (!user) {
      throw new ForbiddenException('User context is missing');
    }

    if (!organizationId) {
      throw new NotFoundException('Organization id is missing');
    }

    if (typeof organizationId !== 'string') {
      throw new NotFoundException('Organization id is invalid');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.id,
        organizationId,
        organization: {
          archivedAt: null,
        },
      },
      select: {
        role: true,
        organizationId: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    request.organization = {
      id: membership.organizationId,
      role: membership.role,
    };

    return true;
  }
}
